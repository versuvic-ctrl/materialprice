

import os
import asyncio
import json
import sys
import re
import psutil
from datetime import datetime
from dotenv import load_dotenv
import pandas as pd
from playwright.async_api import async_playwright

# 절대 import를 위한 경로 설정
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

from data_processor import create_data_processor, log
from supabase import create_client, Client

# --- 1. 초기 설정 및 환경변수 로드 ---
load_dotenv("../../.env.local")

# Supabase 클라이언트 초기화
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# --- 2. 웹 크롤러 클래스 ---


def check_running_crawler():
    """이미 실행 중인 크롤러가 있는지 확인"""
    current_pid = os.getpid()
    current_script = os.path.basename(__file__)
    
    running_crawlers = []
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            if proc.info['pid'] == current_pid:
                continue
                
            cmdline = proc.info['cmdline']
            if cmdline and any(current_script in cmd for cmd in cmdline):
                running_crawlers.append({
                    'pid': proc.info['pid'],
                    'cmdline': ' '.join(cmdline)
                })
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    
    return running_crawlers


# --- 3. Playwright 웹 크롤러 클래스 ---
class KpiCrawler:
    """한국물가정보(KPI) 사이트 크롤러"""
    # <<< 포함할 중분류 및 소분류 설정 >>>
    #
    #   - 중분류 전체를 포함하려면: "중분류명": "__ALL__"
    #   - 특정 소분류만 포함하려면: "중분류명": ["포함할 소분류명1", "포함할 소분류명2"]
    #   - 지정되지 않은 중분류/소분류는 자동으로 제외됩니다
    #
    INCLUSION_LIST = {

    "공통자재": {  # --- 아래 목록을 직접 보시고 필요 없는 줄을 삭제하여 사용하세요 ---
        "봉강": [
            "이형철근(이형봉강)(1)",
            "이형철근(이형봉강)(2)",
            "특수철근",
            "원형철근(원형봉강)",
            "스파이럴철근",
            "나선철선",
            "PC강봉"
            ],
        "형강": [
            "ㄱ형강",
            "ㄷ형강",
            "I형강",
            # "레일",
            "철골브레이스",
            # "TSC BEAM",
            # "OCFT COLUMN",
            "C형강",
            "HyFo BEAM",
            # "ACT COLUMN",
            # "ACT PILE",
            "H형강",
            "용접경량H형강"
        ],
        "강판": [
            "열연강판-1",
            "열연강판-2",
            "후판-1",
            "후판-2",
            "냉연강판-1",
            "냉연강판-2",
            "아연도강판-1",
            "아연도강판-2",
            # "프린트강판",
            # "착색아연도강판(칼라강판)(1)-1",
            # "착색아연도강판(칼라강판)(1)-2",
            # "착색아연도강판(칼라강판)(2)",
        ],
        "강관": [
            "구조용강관",
            "구조용각관"
        ],
        "특수강": [
            "구조용스테인리스관(1)",
            "구조용스테인리스관(2)",
            # "구조용스테인리스관(3)",
            "스테인리스강판(1)",
            "스테인리스강판(2)",
            "스테인리스강판(3)-1",
            "스테인리스강판(3)-2",
            # "스테인리스강판(4)-1",
            # "스테인리스강판(4)-2",
            # "스테인리스채널-H형강",
            # "스테인리스앵글",
            "스테인리스환봉",
            # "스테인리스와이어로프",
            # "주철품ㆍ주강품",
            "특수강"
        ],
        "볼트ㆍ너트": [
            # "너트",
            # "접시머리렌지볼트",
            "보통6각볼트",
            # "스테인리스6각볼트-1",
            # "스테인리스6각볼트-2",
            # "콜라6각볼트(Gr 10.9)-1",
            # "콜라6각볼트(Gr 10.9)-2",
            # "콜라너트",
            "아이볼트",
            # "아이너트",
            "전산볼트",
            "스터드볼트(B7)-1",
            "스터드볼트(B7)-2",
            "U볼트",
            # "절연U볼트",
            "앵커볼트(1)",
            "앵커볼트(2)",
            # "앵커볼트(3)",
            # "앵커볼트(4)",
            # "풀림방지너트"
        ],
        "비철금속": [
            "동제품(1)",
            "동제품(2)",
            "알루미늄제품(1)",
            "알루미늄제품(2)",
            "비철지금(非鐵地金)",
            "연(납)제품(鉛製品)"
        ],
        "시멘트ㆍ콘크리트": [
            "레미콘-1",
            "레미콘-2",
            "시멘트-1",
            "시멘트-2",
            # "시멘트-3",
            # "시멘트-4",
            # "방수·방청시멘트",
            # "특수레미콘",
            "모르터-1",
            "모르터-2",
            "특수시멘트ㆍ타일시멘트(1)",
            "특수시멘트ㆍ타일시멘트(2)",
            # "특수시멘트ㆍ타일시멘트(3)",
            # "드라이모르터(1)",
            # "드라이모르터(2)"
        ],
        "가설자재": [
            # "PDF (더블 프레임) 패널",
            # "복공판 및 안전발판(1)",
            # "복공판 및 안전발판(2)",
            # "레벨봉",
            "유로폼",
            "복공판",
            "강관비계",
            "강관써포트",
            # "조립식틀비계(이동식틀비계)",
        ],
    },

    "토목자재": {
        # "지수판": [
            # "강재토류판",
            # "지수판"
        # ],
        "배수판": [
            # "차수판(1)",
            # "차수판(2)",
            "배수판"
        ],
        "파일류": [
            "스크류파일",
            "고강도콘크리트파일(PHC-A종)(1)",
            "고강도콘크리트파일(PHC-B, C종)(2)",
            # "PHC 두부보강자재 ",
            # "에코스파이럴",
            # "PHC파일 두부보강캡(하부판 스틸제품)",
            # "PHC파일 두부보강캡(하부판 P.E제품)",
            "강관파일(1)",
            "강관파일(2)",
            "복합말뚝(SCP)",
            "복합말뚝(HCP)",
            # "MSTRUT(고강도강관버팀보)",
            # "U형시트파일(열간압연강널말뚝)",
            # "다동심/다축 기초 파일",
        ],
        "도로포장재": [
            "아스팔트(1)",
            "아스팔트(2)",
            "아스팔트콘크리트(1)",
            "아스팔트콘크리트(2)",
            # "아스팔트콘크리트(3)",
            # "하이브리드 투수콘",
            # "투수성콘크리트도로포장재(1)",
            # "투수성콘크리트도로포장재(2)",
            # "흙포장재(1)",
            # "흙포장재(2)",
            # "박층포장재",
            "도로포장용보수재(1)",
            "도로포장용보수재(2)",
            # "도로포장용보수재(3)",
            # "코르크포장재"
        ],
        "경계블록": [
            # "인조화강석경계블록",
            "콘크리트경계블록(1)",
            "콘크리트경계블록(2)",
        ],
        "맨홀": [
            # "조립식맨홀(1)",
            # "조립식맨홀(2)",
            "맨홀(1)",
            "맨홀(2)",
            #"맨홀(3)",
        ],
        "그레이팅": [
            "스틸그레이팅(1)",
            "스틸그레이팅(2)",
        ],
        "철근콘크리트관": [
            # "PC관",
            "철근콘크리트수로관(1)",
            "철근콘크리트수로관(2)",
        ]
    },

    "건축자재": {
        "벽돌": [
            "콘크리트벽돌(시멘트벽돌)(1)",
            "콘크리트벽돌(시멘트벽돌)(2)",
            "내화벽돌"
        ],
        "경량콘크리트판": [
            "조립식내ㆍ외벽패널",
            # "압출성형시멘트판"
        ],
        "미장재": [
            # "불연성 무기질계 접착제",
            "무기질계 내외장 마감재",
            "외벽단열마감재(1)",
            "외벽단열마감재(2)",
            "퍼라이트",
            # "내화피복재"
        ],
        "지붕재": [
            "캐노피지붕재(차양)",
            "세라믹사이딩(외벽재+지붕재)",
            "복합강판",
            "징크"
        ],
        # "접착제": [
            # "접착제(1)",
            # "접착제(2)"
        # ],
        "도료": [
            "방화ㆍ방염ㆍ내열페인트(1)",
            "방화ㆍ방염ㆍ내열페인트(2)",
            "방청페인트(1)",
            "방청페인트(2)",
            # "케이블난연도료",
            "세라믹코팅제(1)",
            "세라믹코팅제(2)",
            "단열페인트",
            "에폭시도료(1)",
            "에폭시도료(2)"
        ],
        "내ㆍ외장패널": [
            # "준불연 성능 벽마감재(상업용·주거용·사무용공간)",
            "알루미늄패널(1)",
            "알루미늄패널(2)",
            "외벽·외장아연도금강판(금속제패널)",
            "준불연실내마감패널",
            "세라믹패널",
            "아연도강판패널",
            "외장패널(금속제패널)",
            "외장패널(석제, 타일 단열패널)",
        ],
        "보온ㆍ단열재": [
            "미네랄울보온판",
            "진공단열재(미라클히트)",
            "진공단열재(파워백)",
            "글라스울단열보온재(1)",
            "글라스울단열보온재(2)",
            # "발포폴리스티렌판(1)",
            # "발포폴리스티렌판(압출)(2)-1",
            # "발포폴리스티렌판(압출)(2)-2",
            # "발포폴리스티렌판(스티로폴)(3)",
            # "발포폴리스티렌판(스티로폴)(4)",
            "준불연 경질 폴리우레탄 폼 단열재",
            #"가교발포폴리에틸렌 보온판 (카이론)",
            "폴리에스터섬유단열재",
            "심재 준불연 발포폴리스티렌 단열재(EPS)",
            "경질폴리우레탄폼단열재(1)-1",
            "경질폴리우레탄폼단열재(1)-2",
        ],
        # "조립식건물재": [
            # "경량철골천장부재(1)",
            # "경량철골천장부재(2)",
            # "샌드위치패널(1)",
            # "샌드위치패널(2)",
            # "샌드위치패널(3)",
            # "칸막이(1)",
            # "칸막이(2)",
            # "칸막이(3)",
        #],
    },

    "급배수": {
        "배관재(Ⅰ)": [
            "일반배관용탄소강관(1)",
            "일반배관용탄소강관(2)",
            "압력배관용탄소강관(ASTM A53)(1)",
            "압력배관용탄소강관(SPPS 38)(2)",
            # "연료가스배관용탄소강관",
            # "송유관",
            # "강관제관이음쇠(나사식)",
            # "강관제관이음쇠(용접식/흑관)-1",
            # "강관제관이음쇠(용접식/흑관)-2",
            # "강관제관이음쇠(용접식/백관)",
            # "강관제관이음쇠(용접식/레듀샤/흑관)-1",
            # "강관제관이음쇠(용접식/레듀샤/백관)-2",
            # "단조플랜지",
            #"단열이중보온관",
            "폴리에틸렌피복강관-1",
            "폴리에틸렌피복강관-2",
            "폴리에틸렌피복강관이형관-1",
            "폴리에틸렌피복강관이형관-2",
            #"폴리에틸렌피복강관이형관-3",
            "배관용스테인리스강관(일반용)-1",
            "배관용스테인리스강관(일반용)-2",
            "배관용스테인리스강관(공업용)",
            "스테인리스Seamless강관-1",
            "스테인리스Seamless강관-2",
            "스테인리스주름관",
            "스테인리스플랜지",
            "스테인리스관이음쇠(용접식)(1)",
            "스테인리스관이음쇠(용접식)(2)",
            # "동파이프",
            # "동관이음쇠",
            # "복합파이프·이음관",
            "FRP DUCT 성형관 및 이음관"  # FRP DUCT(원형) - 호칭경: 2″, 내경: 50㎜
        ],
        "배관재(Ⅱ)": [
            "폴리부틸렌파이프(PB)",
            "경질염화비닐관(PVC파이프)",  # 경질염화비닐관
            "PVC이음관(수도용)",
            "PVC, CPVC 파이프 및 이음관(1)",
            "PVC, CPVC 파이프 및 이음관(2)",
            "일반용폴리에틸렌파이프",    # 일반용PE하수관-무공관 - 규격100㎜, 외경114㎜, 두께5.5㎜, 중량1.79㎏/m
            "수도용폴리에틸렌파이프(1)-1",
            "수도용폴리에틸렌파이프(1)-2",
            "수도용폴리에틸렌파이프(2)",
            "폴리에틸렌파이프ㆍ이음관(1)-1",
            "폴리에틸렌파이프ㆍ이음관(1)-2",
            # "폴리에틸렌파이프ㆍ이음관(2)",
            # "폴리에틸렌파이프ㆍ이음관(3)-1",
            # "폴리에틸렌파이프ㆍ이음관(3)-2",
            "UHP PVDF SDR21/PN16 배관재(1)", #UHP PVDF PIPE SDR21 - 110㎜
            "UHP PVDF SDR21/PN16 배관재(2)",
            "HDPE DC 고압관 및 이음관-1"  ##HDPE DC 고압관 및 이음관 - 100㎜
            "HDPE DC 고압관 및 이음관-2"
            "ECTFE SDR21 배관재",  ##ECTFE PIPE SDR21(1본=5m) - 110㎜
            # "익스팬션조인트",
        ],
        "밸브": [
            # "PVC밸브-1",
            # "PVC밸브-2",
            # "주강제밸브",
            # "주철제밸브",
            # "청동제밸브",
            # "볼밸브(1)",
            # "볼밸브(2)",
            # "스테인리스단조밸브(F304)(일반용)",
            # "스테인리스단조밸브(F316)(가스용)",
            # "단조밸브(A105)(일반용)",
            "컨트롤밸브",
            "스테인리스볼밸브-1",
            "스테인리스볼밸브-2",
            "스테인리스밸브",
            "주강제밸브(CAST CARBON STEEL VALVE)",
            "체크밸브(판)",
            "버터플라이밸브(1)",
            "버터플라이밸브(2)",
            # "버터플라이밸브(3)",
            # "버터플라이밸브(4)",
            # "스팀트랩",
            # "온도조절밸브",
            "안전밸브(1)",
            "안전밸브(2)",
            "감압밸브",
            "세퍼레이터",
            "스트레이너(1)",
            "스트레이너(2)",
            "자동밸브",
        ],
        "펌프류": [
            "축류펌프",
            "사류펌프",
            # "입축 사류 · 축류 펌프",
            # "양흡입(보류트)펌프-1",
            # "양흡입(보류트)펌프-2",
            # "다단와권(보류트)펌프(1)",
            # "다단와권(보류트)펌프(2)",
            # "다단와권(횡형편흡입)펌프",
            "단단와권(보류트)펌프(1)",
            "단단와권(보류트)펌프(2)",
            # "다단와권(터빈)펌프",
            "정량펌프-1",
            "정량펌프-2",
            "내산펌프",
            # "부스타(가압)펌프(1)-1",
            # "부스타(가압)펌프(1)-2",
            # "부스타(가압)펌프(2)-1",
            # "부스타(가압)펌프(2)-2",
            "수중모터펌프(1)",
            "수중모터펌프(2)",
            # "인라인펌프(1)",
            # "인라인펌프(2)",
            # "입형다단펌프(1)",
            # "입형다단펌프(2)",
            # "자동펌프(1)",
            # "자동펌프(2)",
            # "튜브ㆍ호스펌프",
            # "진공펌프"
        ],
        "조ㆍ탱크류": [
            "스테인리스물탱크(1)-1",
            "스테인리스물탱크(1)-2",
            "FRP약품탱크",
            "FRP물탱크-1",
            "FRP물탱크-2",
            "PE케미칼탱크",
            "PE물탱크",
            "FRP정화조(1)",
            "FRP정화조(2)",
        ],
        "파이프커버": [
            # "가교발포폴리에틸렌보온재(카이론)-1",
            # "가교발포폴리에틸렌보온재(카이론)-2",
            # "유리섬유보온재",
            "아마젤에어로젤단열재",
            "미네랄울보온재",
            # "고무발포보온재(카이플렉스)-1",
            # "고무발포보온재(카이플렉스)-2",
            "AES울 불연성단열재",
            # "HITLIN PIPE COVER HG비발수 TYPE 보온재-1",
            # "HITLIN PIPE COVER HG비발수 TYPE 보온재-2",
            "HITLIN PIPE COVER HG발수 TYPE 보온재-1",
            "HITLIN PIPE COVER HG발수 TYPE 보온재-2",
            # "HITLIN PIPE COVER  HGA비발수 TYPE 보온재-1",
            # "HITLIN PIPE COVER  HGA비발수 TYPE 보온재-2",
            # "락킹식보온외장커버(파이프보온)",
            # "락킹식보온외장커버(엘보보온)",
            # "락킹식보온외장커버(밸브보온)",
            # "후크식 보온외장조립카바(파이프보온)",
            # "후크식 보온외장조립카바(엘보보온)",
            # "후크식 보온외장조립카바(밸브보온)"
        ]
    },

    "전기자재": {
        "절연전선": [
            "내열비닐절연전선(HIV)",
            "난연PVC절연접지용전선(F-GV)",
            "저독난연가교폴리올레핀절연전선(HFIX)",
            "난연성폴리프렉스구출선(MLFC)",
            "옥외용비닐절연전선(OW)",
            "인입용비닐절연전선(DV)",
            # "고무절연캡타이어케이블(PNCT)(1)",
            # "고무절연캡타이어케이블(PNCT)(2)",
            # "비닐절연비닐캡타이어케이블(VCT)(1)",
            # "비닐절연비닐캡타이어케이블(VCT)(2)",
            # "전기기기용비닐절연전선(KIV)",
            # "기구용비닐코드",
            # "고무코드(CTF)",
            # "클로로프렌피복인출선(CR배선)",
            # "용접용케이블(WCT)"
        ],
        "전력케이블": [
            "절연난연PVC시스케이블(FW-CV, TFR-CV)",
            # "합금 케이블(하이랙스, HiRaCS)",
            # "절연저독성난연폴리올레핀시스케이블(HFCO)",
            # "수밀형저독성난연동심중성선케이블(FR-CN/CO-W)",
            # "수밀형동심중성선케이블(CN/CV-W)"
        ],
        "제어용케이블": [
            # "절연저독성난연폴리올레핀시스제어용케이블(HFCCO)",
            # "절연저독성난연폴리올레핀시스차폐제어용케이블(HFCCO-SㆍSB)",
            # "절연저독성난연폴리올레핀시스알루미늄마일라테이프제어용케이블(HFCCO-AMSㆍI/C AMS)",
            "절연난연시스제어케이블(FW-CVV)",
            "절연난연시스제어차폐케이블(FW-CVV-SㆍSB)",
            "절연난연시스알루미늄마일라테이프차폐제어케이블(FW-CVV-AMSㆍI/C AMS)"
        ],
        # "소방용케이블": [
            # "난연PVC시스트레이용내화케이블(TFR-8)",
            # "저독성난연폴리올레핀시스트레이용난연내화케이블(NFR-8)",
            # "난연PVC시스화재경보용내열케이블(TFR-3)",
            # "저독성난연폴리올레핀시스화재경보용내열케이블(NFR-3)",
            # "전선관일체형내화전선"
        # ],
        "통신용케이블": [
            # "비닐절연비닐시스전화용국내케이블",
            # "폴리에틸렌절연비닐시스내쌍케이블(CPEV)",
            # "PCM(DS1)케이블",
            "광케이블",
            # "고주파폴리에틸렌절연동축케이블(ECX)",
            # "인터폰선ㆍ전화선ㆍ점퍼선(TIVㆍTOVㆍTJV)",
            # "위성방송수신용케이블(HFBT)",
            # "신호용케이블",
            "LAN(UTP)케이블(1)",
            "LAN(UTP)케이블(2)"
        ],
        # "기타특수케이블": [
            # "가요성알루미늄피케이블",
            # "전선·케이블",
            # "수중케이블(CVF)",
            # "알루미늄도체케이블(ACSR)",
            # "엘리베이터케이블",
            # "테프론전선",
            # "전기용나동선",
            # "에나멜동선ㆍ동부스바",
            # "누수/누유감지시스템",
            # "히팅케이블(1)",
            # "히팅케이블(2)",
            # "히팅케이블(3)",
        # ],
        # "전선원부자재": [
            # "부스덕트 및 부품(1)",
            # "부스덕트 및 부품(2)",
            # "부스덕트 및 부품(3)",
            # "부스덕트 및 부품(4)",
            # "슬리브-1",
            # "슬리브-2",
            # "케이블접속재 및 접속자재",
            # "압착단자, 동관단자, EYECAP",
            # "단자대",
            # "BIMETAL LUG"
        # ],
        "전선관": [
            "광케이블통신관",
            # "나사없는전선관",
            # "나사없는전선관 및 부속품(1)",
            # "나사없는전선관 및 부속품(2)",
            # "나사없는전선관용 원터치이음쇠(EZ커넥터)",
            # "강제전선관",
            # "FC통신관",
            # "강제전선관부품-1",
            # "강제전선관부품-2",
            # "노출배관용부품(전선관용)",
            "경질비닐(PVC)전선관",
            # "경질비닐(PVC)전선관부품",
            "합성수지제가요전선관",
            # "합성수지제가요전선관부품",
            "파상형경질(ELP)전선관",
            "폴리에틸렌(PE)전선관",
            "후렉시블전선관",
            # "후렉시블전선관부품(1)",
            # "후렉시블전선관부품(2)",
            # "몰드",
            # "전선덕트"
        ],
        "전선관로재": [
            # "레이스웨이",
            # "케이블타이",
            # "케이블연소방지제 방화커버",
            # "트레이관통부 FireZero Tray 방화커버",
            # "금속제박스 및 커버(전선관용)",
            # "풀박스",
            # "플라스틱콘트롤BOX(1)",
            # "플라스틱콘트롤BOX(2)",
            # "플라스틱콘트롤BOX(3)",
            "케이블트레이(KSC8464) 및 부속품(1)",
            "케이블트레이(KSC8464) 및 부속품(2)-1",
            "케이블트레이(KSC8464) 및 부속품(2)-2",
            "CABLE TRAY (사다리형, LADDER TRAY)",
            # "내진서포트행거·내진연결조인트",
            # "광덕트",
            "래더트레이",
            # "하이박스"
        ],
        "전력기기": [
            # "전기차충전소 안전시설물",
            # "저손실하이브리드변압기",
            "정류기충전기",
            "변압기(1)",
            "변압기(2)",
            # "변압기(3)",
            # "변압기(4)",
            "무정전전원장치",
            "자동전압조정기",
            "회전위상변환기",
            "소프트스타터",
            # "전해용콘덴서(1)",
            # "전해용콘덴서(2)",
            "기기용콘덴서",
            # "인버터판넬/에너지절전기",
            # "진상용콘덴서",
            # "TWTX 전동기",
            # "유도전동기",
            "인버터판넬",
            # "마이크로서지필터",
            # "조작트랜스포머",
            "인버터(1)",
            "인버터(2)",
            # "인버터(3)",
            # "인버터(4)",
            # "에너지회생장치",
            # "직류전동기제어컨버터",
            "직류전동기제어반"
        ],
        "배전기기": [
            # "변류기보호장치",
            # "피뢰기(LA)",
            # "아크차단기",
            "누전차단기(ELB)(1)-1",
            "누전차단기(ELB)(1)-2",
            "누전차단기(ELB)(2)",
            "배선용차단기(1)",
            "배선용차단기(2)",
            "배선용차단기(3)",
            # "고압전동기 원격 절연저항 측정 시스템",
            "배선용차단기(MCCB)함",
            # "기중차단기(DC)",
            # "기중차단기(A.C.B)",
            "고압개폐기",
            # "전자개폐기",
            # "무정전절체스위치",
            # "진공차단기(V.C.B)",
            # "회로ㆍ가조정형차단기",
            # "전자접촉기",
            # "진공접촉기(VCS)",
            # "열동형과부하계전기",
            # "블록형전원분배기"
        ],
        "절연재료": [
            "절연재료"
        ],
        # "수ㆍ배전반": [
            # "분전반KIT",
            # "분전반 · 계량기함",
            # "IoT스마트컨버터",
            # "지능형분전반",
            # "소수력발전장치"
        # ],
        # "배전제어기기": [
            # "배전제어부품",
            # "계전기(릴레이)(1)",
            # "계전기(릴레이)(2)",
            # "계전기(릴레이)(3)",
            # "계전기(릴레이)(4)",
            # "산업용자동제어기기부품"
        # ],
        # "자동화기기": [
            # "원격통합관리시스템",
            # "원격감시시스템(1)",
            # "원격감시시스템(2)",
            # "원격감시시스템(3)",
            # "프로그래머블 로직 콘트롤러(1)",
            # "프로그래머블 로직 콘트롤러(2)",
            # "프로그래머블 로직 콘트롤러(3)",
            # "프로그래머블 로직 콘트롤러(4)",
            # "전력선통신기반통합제어시스템",
            # "원방감시제어시스템(1)",
            # "원방감시제어시스템(2)",
            # "누수·누액·누유감지시스템",
            # "스마트센서·아이솔레이터"
        # ],
        # "전등": [
            # "형광등",
            # "항공등화(비행장조명기구)(1)",
            # "항공등화(2)",
            # "LED전구",
            # "LED 형광등",
            # "LED 투광등",
            # "나트륨등",
            # "메탈하라이드등",
            # "재실감지센서-1",
            # "재실감지센서-2"
        # ],
    },

    "석유화학": {
        "유화제품": [
            "석유화학제품"
        ],
        "화공약품": [
            "화공약품",
            "시약",
            "에어졸(1)",
            "에어졸(2)",
            # "활성탄소"
        ],
        "합성수지·고무제품": [
            "PVC호스(1)",
            "PVC호스(2)",
            # "불포화폴리에스터수지",
            "방진ㆍ방음패드",
            # "고무호스",
            "고압호스",
            # "고무판(1)",
            # "고무판(2)",
            # "고무용약품",
            "Flake Lining 재",
            "PTFE(테프론)판", ##PTFE(테프론)판(백색) - 5T 1,000×1,000
            "POM(아세탈)판",
            "MC(나일론)판",
            "ABS판",
            "PET판",
            "포맥스판",
            "PVC평판",
            "PPㆍPE평판",
            "PVCㆍPPㆍPE봉",
            "ABS봉",
            "PTFE(테프론)봉",
            # "에폭시봉",
            # "아크릴봉",
            # "아크릴거울",
            # "아크릴평판",
            # "압출아크릴판",
            # "아크릴파이프"
        ],
        # "연료": [
            # "연탄",
            # "무연탄",
            # "연료유",
            # "연료가스",
            # "가스"
        # ],
        # "가스기기": [
            # "가스기기(1)",
            # "가스기기(2)",
            # "가스기기(3)",
            # "가스용기"
        # ],
        "윤활유": [
            # "워셔액",
            # "절연유",
            # "부동액",
            "그리스(1)",
            "그리스(2)",
            # "자동차용윤활유",
            "산업용윤활유"
        ]
    },
    }

    def __init__(self, target_major: str, start_year: str, start_month: str, max_concurrent=3):
        self.base_url = "https://www.kpi.or.kr"
        self.max_concurrent = max_concurrent
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.supabase = supabase  # 전역 supabase 객체 참조
        
        # 새로 추가된 속성들
        self.target_major_category = target_major
        self.start_year = start_year
        self.start_month = start_month
        
        self.processor = create_data_processor('kpi')
        
        # 배치 처리용 변수
        self.batch_data = []
        self.batch_size = 5  # 소분류 5개마다 처리
        self.processed_count = 0
        log(f"크롤러 초기화: 타겟='{self.target_major_category}', 시작날짜={self.start_year}-{self.start_month}")

    async def run(self):
        """크롤링 프로세스 실행"""
        browser = None
        try:
            async with async_playwright() as p:
                # headless=False를 True로 변경하여 서버 환경에서 실행되도록 합니다.
                browser = await p.chromium.launch(headless=True) # ◀◀◀ 이 부분을 수정하세요!
                self.context = await browser.new_context()
                self.page = await self.context.new_page()

                await self._login()
                await self._navigate_to_category()
                await self._crawl_categories()
                
                # 마지막 남은 배치 데이터 처리
                await self._process_final_batch()
                
                log(f"\n🟢 === 크롤링 완료: 총 {self.processed_count}개 소분류 처리됨 === 🟢\n")

                await browser.close()
                return self.processor
        except Exception as e:
            log(f"크롤링 중 오류 발생: {str(e)}", "ERROR")
            if browser:
                try:
                    await browser.close()
                except:
                    pass
            raise

    async def _login(self):
        """로그인 페이지로 이동하여 로그인 수행"""
        await self.page.goto(f"{self.base_url}/www/member/login.asp")

        username = os.environ.get("KPI_USERNAME")
        password = os.environ.get("KPI_PASSWORD")

        if not username or not password:
            raise ValueError(".env.local 파일에 KPI_USERNAME과 "
                             "KPI_PASSWORD를 설정해야 합니다.")

        await self.page.locator("#user_id").fill(username)
        await self.page.locator("#user_pw").fill(password)
        await self.page.locator("#sendLogin").click()

        await self.page.wait_for_load_state('networkidle')
        log("로그인 완료", "SUCCESS")

    async def _navigate_to_category(self):
        """카테고리 페이지로 이동 및 초기 설정 (재시도 로직 포함)"""
        log("종합물가정보 카테고리 페이지로 이동합니다.")
        
        max_retries = 3
        retry_count = 0
        
        while retry_count < max_retries:
            try:
                # 타임아웃을 60초로 증가
                await self.page.goto(
                    f"{self.base_url}/www/price/category.asp",
                    timeout=60000,  # 60초
                    wait_until="domcontentloaded"  # 더 빠른 로딩 완료 조건
                )
                
                # 페이지 로딩 완료 대기
                await self.page.wait_for_load_state('networkidle', timeout=30000)
                
                # 팝업 닫기 (우선 처리)
                await self._close_popups()

                # Right Quick 메뉴 숨기기
                try:
                    close_button = self.page.locator("#right_quick .q_cl")
                    if await close_button.is_visible():
                        await close_button.click()
                        log("Right Quick 메뉴를 숨겼습니다.")
                except Exception as e:
                    log(f"Right Quick 메뉴 숨기기 실패 "
                        f"(이미 숨겨져 있을 수 있음): {e}")
                
                log("카테고리 페이지 이동 완료", "SUCCESS")
                return  # 성공 시 함수 종료
                
            except Exception as e:
                retry_count += 1
                log(f"카테고리 페이지 이동 실패 (시도 {retry_count}/{max_retries}): {e}", "WARNING")
                
                if retry_count < max_retries:
                    wait_time = retry_count * 5  # 5초, 10초, 15초 대기
                    log(f"{wait_time}초 후 재시도합니다...", "INFO")
                    await asyncio.sleep(wait_time)
                else:
                    log("카테고리 페이지 이동 최대 재시도 횟수 초과", "ERROR")
                    raise e

    async def _close_popups(self):
        """페이지의 모든 팝업을 닫는 메서드"""
        try:
            # 1. 일반적인 팝업 닫기 버튼들 시도
            popup_close_selectors = [
                ".pop-btn-close",  # 일반적인 팝업 닫기 버튼
                ".btnClosepop",    # 특정 팝업 닫기 버튼
                "#popupNotice .pop-btn-close",  # 공지사항 팝업 닫기
                ".ui-popup .pop-btn-close",     # UI 팝업 닫기
                "button[class*='close']",       # close가 포함된 버튼
                "a[class*='close']"             # close가 포함된 링크
            ]
            
            for selector in popup_close_selectors:
                try:
                    popup_close = self.page.locator(selector)
                    if await popup_close.count() > 0:
                        # 모든 매칭되는 요소에 대해 닫기 시도
                        for i in range(await popup_close.count()):
                            element = popup_close.nth(i)
                            if await element.is_visible():
                                await element.click(timeout=3000)
                                log(f"팝업 닫기 성공: {selector}")
                                await self.page.wait_for_timeout(500)  # 팝업이 닫힐 시간 대기
                except Exception:
                    continue  # 다음 셀렉터 시도
            
            # 2. ESC 키로 팝업 닫기 시도
            await self.page.keyboard.press('Escape')
            await self.page.wait_for_timeout(500)
            
            log("팝업 닫기 처리 완료")
            
        except Exception as e:
            log(f"팝업 닫기 처리 중 오류: {e}")

    async def _crawl_categories(self):
        """대분류 -> 중분류 -> 소분류 순차적으로 크롤링"""
        major_selector = '#left_menu_kpi > ul.panel'
        major_categories = await self.page.locator(
            major_selector).first.locator('li.file-item > a').all()

        major_links = []
        for cat in major_categories:
            text = await cat.inner_text()
            href = await cat.get_attribute('href')
            major_links.append({'name': text, 'url': f"{self.base_url}{href}"})

        for major in major_links:
            # <<< 여기에 코드 추가 (3/4) - 대분류 필터링 >>>
            if major['name'] != self.target_major_category:
                continue  # 타겟 대분류가 아니면 건너뛰기

            log(f"대분류 '{major['name']}' 크롤링 시작...")
            await self.page.goto(major['url'])
            
            # 페이지 로딩 대기 - 기본 대기 시간만 적용 (서버 환경 고려하여 10초)
            log("페이지 로딩을 위한 기본 대기 시간 적용 (10초)")
            await self.page.wait_for_timeout(10000)
            
            # 주석처리: 불필요한 선택자 시도 부분 (계속 실패하여 시간만 소모)
            # try:
            #     # 카테고리 목록 컨테이너 대기 (여러 선택자 시도)
            #     selectors_to_try = [
            #         ".part-list",  # 기존 선택자
            #         "ul li a[href*='CATE_CD=']",  # 카테고리 링크들
            #         "li a[href*='/www/price/category.asp']",  # 카테고리 페이지 링크들
            #         ".category-list",  # 가능한 카테고리 리스트 클래스
            #     ]
            #     
            #     page_loaded = False
            #     for selector in selectors_to_try:
            #         try:
            #             await self.page.wait_for_selector(selector, timeout=10000)
            #             log(f"페이지 로딩 완료 - 선택자: {selector}")
            #             page_loaded = True
            #             break
            #         except Exception as e:
            #             log(f"선택자 {selector} 대기 실패: {str(e)}")
            #             continue
            #     
            #     if not page_loaded:
            #         log("모든 선택자 시도 실패, 기본 대기 시간 적용")
            #         await self.page.wait_for_timeout(3000)
            #         
            # except Exception as e:
            #     log(f"페이지 로딩 대기 중 오류: {str(e)}")
            #     await self.page.wait_for_timeout(3000)

            # openSub() 버튼 클릭하여 모든 중분류와 소분류를 한번에 펼치기
            open_sub_selector = 'a[href="javascript:openSub();"]'
            open_sub_button = self.page.locator(open_sub_selector)
            if await open_sub_button.count() > 0:
                log("openSub() 버튼을 클릭하여 모든 분류를 펼칩니다.")
                await open_sub_button.click()
                # 분류가 펼쳐질 시간을 기다림 (2초 -> 5초로 증가)
                await self.page.wait_for_timeout(5000) # 더 넉넉한 대기 시간
                # 또는, 특정 중분류 목록이 실제로 visible 해질 때까지 기다리기 (더 견고한 방법)
                try:
                    await self.page.wait_for_selector('.part-ttl > a', state='visible', timeout=15000)
                    log("중분류 요소들이 화면에 완전히 로드되었습니다.")
                except Exception as e:
                    log(f"중분류 요소 가시성 대기 실패: {e}", "WARNING")
                    # 실패해도 일단 진행하도록 함. 다음 로직에서 다시 요소를 찾을 것이므로.

                # HTML 구조 확인을 위해 페이지 내용 출력
                html_content = await self.page.content()
                # HTML 구조 확인을 위해 페이지 내용 출력
                part_ttl_start = html_content.find('part-ttl')
                if 'part-ttl' in html_content:
                    sample_end = part_ttl_start + 1000
                    html_sample = html_content[part_ttl_start:sample_end]
                    log(f"페이지 HTML 샘플 (part-ttl 관련): {html_sample}")
                else:
                    log("페이지 HTML 샘플 (part-ttl 관련): "
                        "part-ttl 없음")
            else:
                # 대분류 '공통자재' 클릭하여 중분류 목록 펼치기
                # 이 부분도 위에 openSub() 처럼 대기 시간을 늘려주는 것이 좋습니다.
                category_link = 'a[href="category.asp?CATE_CD=101"]'
                await self.page.click(category_link)
                await self.page.wait_for_timeout(3000) # 1초 -> 3초로 증가
                log("중분류 및 소분류 목록을 펼쳤습니다.")

            # 소분류 목록이 나타날 때까지 대기
            # 이 wait_for_selector는 사실상 .part-ttl 아래의 중분류를 대기하는 것이므로,
            # .part-ttl이 visible 상태가 되는 것을 기다리는 것이 더 정확할 수 있습니다.
            await self.page.wait_for_selector(".part-list", timeout=15000) # 타임아웃 증가

            # 중분류 정보를 미리 수집
            middle_selector = '.part-ttl > a'
            middle_categories_elements = await self.page.locator(
                middle_selector).all()
            log(f"  발견된 중분류 개수: {len(middle_categories_elements)}")

            middle_categories_info = []
            for i, middle_element in enumerate(middle_categories_elements):
                try:
                    middle_name = await middle_element.inner_text()
                    middle_href = await middle_element.get_attribute('href')
                    if middle_href and 'CATE_CD=' in middle_href:
                        middle_categories_info.append({
                            'name': middle_name,
                            'href': middle_href
                        })
                        log(f"  발견된 중분류: '{middle_name}' "
                            f"(CATE_CD: {middle_href})")
                except Exception as e:
                    log(f"  중분류 {i + 1} 정보 수집 중 오류: {str(e)}")
                    continue

            # 각 중분류를 순차적으로 방문하여 소분류 수집
            for middle_info in middle_categories_info:
                middle_name = middle_info['name']
                middle_href = middle_info['href']
                # <<< 중분류 포함 로직 >>>
                inclusions_for_major = self.INCLUSION_LIST.get(major['name'], {})
                
                # 대분류에 설정이 없으면 모든 중분류 제외
                if not inclusions_for_major:
                    log(f"  [SKIP] 포함 목록 없음: 중분류 '{middle_name}' 건너뜁니다.")
                    continue
                
                # 대분류가 "__ALL__"로 설정된 경우 모든 중분류 포함
                if inclusions_for_major == "__ALL__":
                    log(f"  중분류 '{middle_name}' 포함 (대분류 전체 포함 설정)")
                else:
                    # 중분류가 포함 목록에 없으면 제외
                    if middle_name not in inclusions_for_major:
                        log(f"  [SKIP] 포함 목록에 없음: 중분류 '{middle_name}' 건너뜁니다.")
                        continue

                try:
                    # 중분류 페이지로 이동
                    middle_url = f"{self.base_url}/www/price/{middle_href}"
                    log(f"  중분류 '{middle_name}' "
                        f"페이지로 이동: {middle_url}")
                    await self.page.goto(middle_url)
                    await self.page.wait_for_load_state(
                        'networkidle')

                    # 소분류가 숨겨져 있을 수 있으므로 직접 찾기
                    await self.page.wait_for_timeout(2000)

                    # 다양한 방법으로 소분류 찾기
                    sub_categories_info = []

                    # 방법 1: ul.part-list 내의 링크들
                    part_list_selector = 'ul.part-list'
                    part_lists = await self.page.locator(
                        part_list_selector).all()
                    for part_list in part_lists:
                        if await part_list.count() > 0:
                            sub_selector = 'li a'
                            sub_elements = await part_list.locator(
                                sub_selector).all()
                            for sub_element in sub_elements:
                                try:
                                    sub_name = await sub_element.inner_text()
                                    sub_href = await sub_element.get_attribute(
                                        'href')
                                    has_cate_cd = (
                                        sub_href and
                                        'CATE_CD=' in sub_href)
                                    if has_cate_cd:
                                        sub_categories_info.append({
                                            'name': sub_name,
                                            'href': sub_href
                                        })
                                        log(f"    발견된 소분류: "
                                            f"'{sub_name}'")
                                except Exception as e:
                                    log(f"    소분류 정보 수집 중 오류: "
                                        f"{str(e)}")
                                    continue

                    # 방법 2: 만약 위에서 찾지 못했다면 다른 선택자 시도
                    if not sub_categories_info:
                        try:
                            # 소분류 링크 찾기
                            detail_selector = (
                                'a[href*="detail.asp?CATE_CD="]')
                            all_links = await self.page.locator(
                                detail_selector).all()
                            for link in all_links:
                                try:
                                    sub_name = await link.inner_text()
                                    sub_href = await link.get_attribute(
                                        'href')
                                    if sub_href and sub_name.strip():
                                        sub_categories_info.append({
                                            'name': sub_name.strip(),
                                            'href': sub_href
                                        })
                                except Exception:
                                    continue
                        except Exception as e:
                            # 방법2 소분류 검색 중 오류 발생 (로그 생략)
                            pass

                    if not sub_categories_info:
                        log(f"    중분류 '{middle_name}'의 "
                            f"소분류를 찾을 수 없습니다.")
                        continue

                    sub_count = len(sub_categories_info)
                    log(f"    중분류 '{middle_name}' - "
                        f"발견된 소분류 개수: {sub_count}")

                    # 수집된 소분류 정보로 병렬 데이터 크롤링
                    await self._crawl_subcategories_parallel(
                        major['name'], middle_name, sub_categories_info)

                except Exception as e:
                    log(f"  중분류 '{middle_name}' 처리 중 오류: {str(e)}")
                    continue

    async def _crawl_subcategories_parallel(self, major_name,
                                            middle_name,
                                            sub_categories_info):
        """소분류들을 병렬로 크롤링"""
        # <<< 소분류 포함 로직 >>>
        inclusions_for_major = self.INCLUSION_LIST.get(major_name, {})
        
        # 대분류가 "__ALL__"로 설정된 경우 모든 중분류와 소분류 포함
        if inclusions_for_major == "__ALL__":
            log(f"    대분류 '{major_name}' 전체 포함 설정 - 중분류 '{middle_name}' 모든 소분류 포함")
        else:
            sub_inclusion_rule = inclusions_for_major.get(middle_name, [])
            
            # 중분류가 "__ALL__"이 아닌 경우, 특정 소분류만 포함
            if sub_inclusion_rule != "__ALL__":
                if isinstance(sub_inclusion_rule, list) and sub_inclusion_rule:
                    filtered_subs = []
                    for sub_info in sub_categories_info:
                        if sub_info['name'] in sub_inclusion_rule:
                            filtered_subs.append(sub_info)
                        else:
                            log(f"    [SKIP] 포함 목록에 없음: 소분류 '{sub_info['name']}' 건너뜁니다.")
                    sub_categories_info = filtered_subs  # 필터링된 목록으로 교체
                else:
                    # 빈 리스트이거나 잘못된 형식인 경우 모든 소분류 제외
                    log(f"    [SKIP] 포함할 소분류 없음: 중분류 '{middle_name}' 모든 소분류 건너뜁니다.")
                    return

        if not sub_categories_info:
            log(f"    중분류 '{middle_name}': "
                f"처리할 소분류가 없습니다.")
            return

        sub_count = len(sub_categories_info)
        log(f"    중분류 '{middle_name}': {sub_count}개 "
            f"소분류를 병렬로 처리합니다.")

        # 병렬 작업 생성
        tasks = []
        for sub_info in sub_categories_info:
            task = self._crawl_single_subcategory(
                major_name, middle_name, sub_info)
            tasks.append(task)

        # 병렬 실행
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # 결과 처리 및 배치 데이터 수집
        success_count = 0
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                sub_name = sub_categories_info[i]['name']
                log(f"    소분류 '{sub_name}' 처리 실패: {str(result)}")
            else:
                success_count += 1
                # 성공한 소분류 데이터를 배치에 추가
                sub_info = sub_categories_info[i]
                self.batch_data.append({
                    'major': major_name,
                    'middle': middle_name,
                    'sub': sub_info['name'],
                    'result': result
                })
                
                # 배치 크기에 도달하면 처리
                if len(self.batch_data) >= self.batch_size:
                    await self._process_batch()

        total_count = len(sub_categories_info)
        log(f"    중분류 '{middle_name}' 완료: "
            f"{success_count}/{total_count}개 성공")
    
    async def _process_batch(self):
        """배치 데이터 처리 (pandas 가공 및 supabase 저장)"""
        if not self.batch_data:
            return
            
        batch_count = len(self.batch_data)
        log(f"\n=== 배치 처리 시작: {batch_count}개 소분류 ===\n")
        
        # 각 소분류별로 데이터 처리
        total_processed = 0
        total_saved = 0
        
        for batch_item in self.batch_data:
            try:
                # pandas 가공
                processed_data = await self.processor.process_data(
                    batch_item['major'], 
                    batch_item['middle'], 
                    batch_item['sub']
                )
                
                if processed_data:
                    processed_count = len(processed_data)
                    total_processed += processed_count
                    
                    # supabase 저장
                    saved_count = await self.processor.save_to_supabase(processed_data)
                    total_saved += saved_count
                    
                    log(f"  - {batch_item['sub']}: pandas 가공 {processed_count}개, "
                        f"supabase 저장 {saved_count}개")
                else:
                    log(f"  - {batch_item['sub']}: 처리할 데이터 없음")
                    
            except Exception as e:
                log(f"  - {batch_item['sub']} 처리 실패: {str(e)}")
        
        log(f"\n=== 배치 처리 완료: pandas 가공 {total_processed}개, "
            f"supabase 저장 {total_saved}개 ===\n")
        
        # 배치 데이터 초기화
        self.batch_data = []
        self.processed_count += batch_count
    
    async def _process_final_batch(self):
        """마지막 남은 배치 데이터 처리"""
        if self.batch_data:
            log(f"\n=== 최종 배치 처리: {len(self.batch_data)}개 소분류 ===\n")
            await self._process_batch()

    async def _crawl_single_subcategory(self, major_name,
                                        middle_name, sub_info):
        """단일 소분류 크롤링 (세마포어로 동시 실행 수 제한)"""
        async with self.semaphore:
            sub_name = sub_info['name']
            sub_href = sub_info['href']
            sub_url = f"{self.base_url}/www/price/{sub_href}"

            log(f"  - 중분류 '{middle_name}' > "
                f"소분류 '{sub_name}' 데이터 수집 시작")

            try:
                # 새로운 페이지 컨텍스트 생성 (병렬 처리를 위해)
                new_page = await self.context.new_page()
                await new_page.goto(sub_url)
                await new_page.wait_for_load_state('networkidle')

                # 가격 데이터 수집
                result = await self._get_price_data_with_page(
                    new_page, major_name, middle_name, sub_name, sub_url)

                # 페이지 정리
                await new_page.close()

                # 수집된 데이터가 있으면 즉시 처리하고 저장
                has_data = (result and hasattr(result, 'raw_data_list')
                            and result.raw_data_list)
                if has_data:
                    log(f"  - 소분류 '{sub_name}' 데이터 처리 및 저장 시작")

                    # DataFrame으로 변환
                    df = result.to_dataframe()

                    if not df.empty:
                        # DataFrame을 딕셔너리 리스트로 변환하여 저장
                        processed_data = df.to_dict(orient='records')
                        # Supabase에 저장 (중복 체크 활성화)
                        saved_count = await result.save_to_supabase(processed_data, 'kpi_price_data', check_duplicates=True)
                        log(f"  ✅ '{sub_name}' 완료: "
                            f"{len(df)}개 데이터 → Supabase 저장 {saved_count}개 성공")
                    else:
                        log(f"  ⚠️ '{sub_name}' 완료: 저장할 데이터 없음")

                return result

            except Exception as e:
                error_msg = (f"  소분류 '{sub_name}' 처리 중 오류 "
                             f"[대분류: {major_name}, 중분류: {middle_name}]: "
                             f"{str(e)}")
                log(error_msg)
                raise e

    async def _get_price_data(self, major_name, middle_name,
                             sub_name, sub_url):
        """기존 메서드 호환성을 위한 래퍼"""
        return await self._get_price_data_with_page(
            self.page, major_name, middle_name, sub_name, sub_url)



    async def _check_existing_data(self, major_name, middle_name, 
                                  sub_name, spec_name):
        """Supabase에서 기존 데이터 확인하여 중복 체크"""
        try:
            response = self.supabase.table('kpi_price_data').select(
                'date, region, price, specification'
            ).eq(
                'major_category', major_name
            ).eq(
                'middle_category', middle_name
            ).eq(
                'sub_category', sub_name
            ).eq(
                'specification', spec_name
            ).execute()
            
            if response.data:
                # (날짜, 지역, 가격, 규격) 조합으로 완전 중복 체크
                # pandas 가공 후 컬럼명 변경 고려 (region_name -> region)
                existing_data = set()
                for item in response.data:
                    existing_data.add((item['date'], item['region'], str(item['price']), item['specification']))
                log(f"        - 기존 데이터 발견: {len(existing_data)}개 (날짜-지역-가격-규격 조합)")
                return existing_data
            else:
                log("        - 기존 데이터 없음: 전체 추출 필요")
                return set()
                
        except Exception as e:
            log(f"        - 기존 데이터 확인 중 오류: {str(e)}")
            return set()  # 오류 시 전체 추출
    
    async def _get_available_date_range(self, page):
        """페이지에서 사용 가능한 날짜 범위 확인"""
        try:
            # 헤더에서 날짜 정보 추출
            selector = "#priceTrendDataArea th"
            await page.wait_for_selector(selector, timeout=5000)
            header_elements = await page.locator(selector).all()

            if len(header_elements) > 1:
                dates = []
                for i in range(1, len(header_elements)):
                    header_text = await header_elements[i].inner_text()
                    dates.append(header_text.strip())
                return dates
            else:
                return []

        except Exception as e:
            log(f"        - 날짜 범위 확인 중 오류: {str(e)}")
            return []

    async def _get_price_data_with_page(self, page, major_name, 
                                        middle_name, sub_name, sub_url):
        """소분류 페이지에서 월별 가격 데이터를 추출"""
        try:
            # 페이지 상태 확인
            if page.is_closed():
                log(f"페이지가 닫혀있어 '{sub_name}' 처리를 건너뜁니다.", "ERROR")
                return None
                
            # 페이지는 이미 로드된 상태로 전달됨
            await page.wait_for_load_state('networkidle', timeout=30000)

            # '물가추이 보기' 탭으로 이동
            try:
                # 탭이 존재하는지 먼저 확인
                await page.wait_for_selector('a:has-text("물가추이 보기")', timeout=15000)
                
                # 재시도 로직 추가
                for retry in range(3):
                    try:
                        await page.get_by_role('link', name='물가추이 보기').click(timeout=30000)
                        await page.wait_for_selector("#ITEM_SPEC_CD", timeout=30000)
                        break
                    except Exception as e:
                        if retry == 2:
                            raise e
                        log(f"물가추이 보기 탭 클릭 재시도 {retry + 1}/3: {e}", "WARNING")
                        await page.reload()
                        await page.wait_for_load_state('networkidle', timeout=30000)
                        
            except Exception as e:
                log(f"물가추이 보기 탭 클릭 실패: {str(e)}", "ERROR")
                return None

            # 규격 선택 옵션들 가져오기
            spec_options = await page.locator('#ITEM_SPEC_CD option').all()

            raw_item_data = {
                'major_category_name': major_name,
                'middle_category_name': middle_name,
                'sub_category_name': sub_name,
                'spec_data': []
            }

            # 병렬 처리를 위해 규격 데이터를 먼저 수집
            spec_list = []
            for option in spec_options:
                spec_value = await option.get_attribute('value')
                spec_name = await option.inner_text()
                if spec_value and spec_name.strip():  # 빈 값 제외
                    spec_list.append({'value': spec_value, 'name': spec_name})

            # 모든 규격을 최적화된 순차 처리로 진행
            log(f"    - {len(spec_list)}개 규격을 "
                f"최적화된 순차 처리로 진행합니다.")
            await self._process_specs_optimized(
                page, spec_list, raw_item_data,
                major_name, middle_name, sub_name)

        except Exception as e:
            log(f"  소분류 '{sub_name}' 처리 중 오류 "
                f"[대분류: {major_name}, 중분류: {middle_name}]: {str(e)}", "ERROR")
            return None

        # 수집된 데이터 처리 - 새로운 DataProcessor 인스턴스 생성
        local_processor = create_data_processor('kpi')
        if raw_item_data['spec_data']:
            local_processor.add_raw_data(raw_item_data)
            spec_count = len(raw_item_data['spec_data'])
            log(f"  - '{sub_name}' 데이터 수집 완료 "
                f"(총 {spec_count}개 규격)")
        else:
            log(f"  - '{sub_name}': 수집된 규격 데이터 없음")

        return local_processor

    async def _process_specs_optimized(
            self, page, spec_list, raw_item_data,
            major_name, middle_name, sub_name):
        """최적화된 순차 처리 - 페이지 리로드 없이 빠른 규격 변경"""
        for i, spec in enumerate(spec_list):
            try:
                spec_value = spec['value']
                spec_name = spec['name']
                log(f"      - 규격 {i + 1}/{len(spec_list)}: "
                    f"'{spec_name}' 조회 중...")

                # 기존 데이터 확인
                existing_dates = await self._check_existing_data(
                    major_name, middle_name, sub_name, spec_name
                )

                # 규격 선택 (대기 시간 최소화)
                spec_selector = '#ITEM_SPEC_CD'
                await page.locator(spec_selector).select_option(
                    value=spec_value)
                await page.wait_for_load_state('networkidle', timeout=3000)

                # 기간 선택 (첫 번째 규격에서만 설정)
                if i == 0:
                    # 시작 기간: 2020년 1월
                    year_from_selector = '#DATA_YEAR_F'
                    month_from_selector = '#DATA_MONTH_F'
                    await page.locator(year_from_selector).select_option(
                        value='2020')
                    await page.locator(month_from_selector).select_option(
                        value='01')
                    
                    # 종료 기간: 현재 년월
                    current_date = datetime.now()
                    current_year = str(current_date.year)
                    current_month = str(current_date.month).zfill(2)
                    
                    year_to_selector = '#DATA_YEAR_T'
                    month_to_selector = '#DATA_MONTH_T'
                    await page.locator(year_to_selector).select_option(
                        value=current_year)
                    await page.locator(month_to_selector).select_option(
                        value=current_month)
                    
                    await page.wait_for_load_state(
                        'networkidle', timeout=10000)
                    
                    # 검색 버튼 클릭 (기간 설정 후 반드시 실행) - 재시도 로직 추가
                    search_selector = 'form[name="sForm"] input[type="image"]'
                    search_button = page.locator(search_selector)
                    
                    # 재시도 로직 (최대 3회 시도)
                    for attempt in range(3):
                        try:
                            await search_button.click(timeout=10000)
                            break
                        except Exception as e:
                            if attempt == 2:  # 마지막 시도
                                raise e
                            log(f"        - 검색 버튼 클릭 실패 (시도 {attempt + 1}/3), 2초 후 재시도...")
                            await asyncio.sleep(2)
                    
                    log(f"        - 기간 설정 완료: 2020.01 ~ "
            f"{current_year}.{current_month}")
                else:
                    # 첫 번째 규격이 아닌 경우에도 검색 버튼 클릭 - 재시도 로직 추가
                    search_selector = 'form[name="sForm"] input[type="image"]'
                    search_button = page.locator(search_selector)
                    
                    # 재시도 로직 (최대 3회 시도)
                    for attempt in range(3):
                        try:
                            await search_button.click(timeout=10000)
                            break
                        except Exception as e:
                            if attempt == 2:  # 마지막 시도
                                raise e
                            log(f"        - 검색 버튼 클릭 실패 (시도 {attempt + 1}/3), 2초 후 재시도...")
                            await asyncio.sleep(2)

                # 테이블 로딩 대기 (데이터가 로드될 때까지) - 재시도 로직 추가
                table_selector = "#priceTrendDataArea tr"
                
                # 재시도 로직 (최대 3회 시도)
                for attempt in range(3):
                    try:
                        await page.wait_for_selector(table_selector, timeout=15000)
                        await page.wait_for_load_state('networkidle', timeout=10000)
                        break
                    except Exception as e:
                        if attempt == 2:  # 마지막 시도
                            raise e
                        log(f"        - 테이블 로딩 대기 실패 (시도 {attempt + 1}/3), 2초 후 재시도...")
                        await asyncio.sleep(2)

                # 사용 가능한 날짜 범위 확인
                available_dates = await self._get_available_date_range(page)
                if not available_dates:
                    log("        - 사용 가능한 날짜 없음")
                    continue
                
                # 기존 데이터에서 날짜만 추출하여 비교
                existing_date_set = set()
                if existing_dates:
                    existing_date_set = {item[0] for item in existing_dates}  # 튜플의 첫 번째 요소(날짜)만 추출
                
                # 누락된 날짜만 추출
                missing_dates = [date for date in available_dates 
                               if date not in existing_date_set]
                
                if not missing_dates:
                    continue
                
                # 누락된 날짜에 대해서만 가격 데이터 추출
                await self._extract_price_data_fast(
                    page, spec_name, raw_item_data, existing_dates)

            except Exception as e:
                # 규격 처리 중 오류
                log(f"규격 '{spec['name']}' 처리 오류: {str(e)}", "ERROR")
                continue

    async def _extract_price_data_fast(self, page, spec_name,
                                       raw_item_data, existing_dates=None):
        """빠른 가격 데이터 추출 - 누락된 데이터만 추출"""
        try:
            # 테이블 구조 감지 및 처리
            # 1. 지역 헤더가 있는 복합 테이블 (첫 번째 이미지 형태)
            # 2. 날짜와 가격만 있는 단순 테이블 (두 번째 이미지 형태)
            
            # 테이블에서 첫 번째 행 확인
            all_table_rows = await page.locator("table").nth(1).locator("tr").all()
            if not all_table_rows:
                log(f"      - 규격 '{spec_name}': 테이블을 찾을 수 없음")
                return

            # 첫 번째 행 분석하여 테이블 타입 결정
            first_row = all_table_rows[0]
            first_row_elements = await first_row.locator("td").all()
            if not first_row_elements:
                first_row_elements = await first_row.locator("th").all()
            
            if not first_row_elements:
                log(f"      - 규격 '{spec_name}': 첫 번째 행이 비어있음")
                return

            # 첫 번째 행의 첫 번째 셀 텍스트 확인
            first_cell_text = await first_row_elements[0].inner_text()
            first_cell_clean = first_cell_text.strip()
            
            # 테이블 타입 결정
            is_simple_table = (
                self._is_valid_date_value(first_cell_clean) or 
                self._is_valid_date_header(first_cell_clean)
            )
            
            if is_simple_table:
                # 단순 테이블 처리 (날짜 + 가격)
                await self._extract_simple_table_data(
                    all_table_rows, spec_name, raw_item_data, existing_dates
                )
            else:
                # 복합 테이블 처리 (지역 헤더 + 날짜별 데이터)
                await self._extract_complex_table_data(
                    all_table_rows, spec_name, raw_item_data, existing_dates
                )

        except Exception as e:
            log(f"'{spec_name}' 오류: {str(e)}", "ERROR")

    async def _extract_simple_table_data(self, all_table_rows, spec_name, 
                                       raw_item_data, existing_dates):
        """단순 테이블 데이터 추출 (날짜 + 가격 형태)"""
        try:
            extracted_count = 0
            default_region = "전국"  # 지역 정보가 없는 경우 기본값
            
            for row_idx, row in enumerate(all_table_rows):
                try:
                    # 행의 모든 셀 추출
                    cells = await row.locator("td").all()
                    if not cells:
                        cells = await row.locator("th").all()
                    
                    if len(cells) < 2:  # 최소 날짜와 가격 필요
                        continue
                    
                    # 첫 번째 셀에서 날짜 추출
                    date_str = await cells[0].inner_text()
                    date_clean = date_str.strip()
                    
                    # 날짜 유효성 검증
                    if not self._is_valid_date_value(date_clean):
                        continue
                    
                    formatted_date = self._format_date_header(date_clean)
                    if not formatted_date:
                        continue
                    
                    # 두 번째 셀에서 가격 추출
                    price_str = await cells[1].inner_text()
                    
                    if self._is_valid_price(price_str):
                        clean_price = price_str.strip().replace(',', '')
                        try:
                            price_value = float(clean_price)
                            
                            # 중복 체크
                            if existing_dates and (formatted_date, default_region, str(price_value), spec_name) in existing_dates:
                                continue
                            
                            price_data = {
                                'spec_name': spec_name,
                                'region': default_region,
                                'date': formatted_date,
                                'price': price_value
                            }
                            spec_data = raw_item_data['spec_data']
                            spec_data.append(price_data)
                            extracted_count += 1
                            
                            if extracted_count % 50 == 0:
                                log(f"진행: {extracted_count}개 추출됨")
                        except ValueError:
                            continue
                
                except Exception as e:
                    log(f"      - 행 처리 중 오류: {str(e)}")
                    continue
            
            if extracted_count > 0:
                log(f"'{spec_name}' (단순형): {extracted_count}개 완료", "SUCCESS")
                
        except Exception as e:
            log(f"단순 테이블 처리 오류: {str(e)}", "ERROR")

    async def _extract_complex_table_data(self, all_table_rows, spec_name, 
                                        raw_item_data, existing_dates):
        """복합 테이블 데이터 추출 (지역 헤더 + 날짜별 데이터)"""
        try:
            # 지역 헤더 행 추출 (첫 번째 행)
            if len(all_table_rows) < 1:
                return
                
            region_header_row = all_table_rows[0]
            region_header_elements = await region_header_row.locator("td").all()
            if not region_header_elements:
                region_header_elements = await region_header_row.locator("th").all()
            
            if not region_header_elements:
                log(f"      - 규격 '{spec_name}': 지역 헤더를 찾을 수 없음")
                return

            # 지역 헤더 추출 (첫 번째 컬럼 '구분' 제외, 유효한 지역만)
            regions = []
            valid_region_indices = []
            for i in range(1, len(region_header_elements)):
                header_text = await region_header_elements[i].inner_text()
                region_name = self._clean_region_name(header_text.strip())
                if self._is_valid_region_name(region_name):
                    regions.append(region_name)
                    valid_region_indices.append(i)

            if not regions:
                return

            # 데이터 행 추출 (두 번째 행부터)
            data_rows = all_table_rows[1:] if len(all_table_rows) >= 2 else []
            if not data_rows:
                return

            extracted_count = 0
            # 각 날짜별 데이터 처리
            for row_idx, row in enumerate(data_rows):
                try:
                    # 첫 번째 셀에서 날짜 추출
                    date_element = row.locator("td").first
                    if not await date_element.count():
                        date_element = row.locator("th").first

                    if not await date_element.count():
                        continue

                    date_str = await date_element.inner_text()
                    date_clean = date_str.strip()
                    
                    # 날짜 형식 변환 및 중복 체크
                    if not self._is_valid_date_value(date_clean):
                        continue
                    
                    formatted_date = self._format_date_header(date_clean)
                    if not formatted_date:
                        continue
                    
                    # 날짜 유효성 재검증
                    if not self._is_valid_date_header(date_clean):
                        continue

                    # 해당 행의 모든 가격 셀 추출 (첫 번째 셀 제외)
                    price_cells = await row.locator("td").all()
                    if not price_cells:
                        all_cells = await row.locator("th").all()
                        price_cells = all_cells[1:] if len(all_cells) > 1 else []

                    # 각 지역별 가격 처리
                    for region_idx, region_name in enumerate(regions):
                        cell_idx = region_idx + 1
                        if cell_idx >= len(price_cells):
                            continue
                            
                        price_cell = price_cells[cell_idx]
                        price_str = await price_cell.inner_text()
                        
                        if self._is_valid_price(price_str):
                            clean_price = price_str.strip().replace(',', '')
                            try:
                                price_value = float(clean_price)
                                
                                # 중복 체크
                                if existing_dates and (formatted_date, region_name, str(price_value), spec_name) in existing_dates:
                                    continue
                                    
                                price_data = {
                                    'spec_name': spec_name,
                                    'region': region_name,
                                    'date': formatted_date,
                                    'price': price_value
                                }
                                spec_data = raw_item_data['spec_data']
                                spec_data.append(price_data)
                                extracted_count += 1
                                
                                if extracted_count % 50 == 0:
                                    log(f"진행: {extracted_count}개 추출됨")
                            except ValueError:
                                continue
                        else:
                            continue
                except Exception as e:
                    log(f"      - 행 처리 중 오류: {str(e)}")
                    continue

            if extracted_count > 0:
                log(f"'{spec_name}' (복합형): {extracted_count}개 완료", "SUCCESS")

        except Exception as e:
            log(f"복합 테이블 처리 오류: {str(e)}", "ERROR")

    def _clean_region_name(self, region_str):
        """지역명 정리 함수 - '서울1', '부산2' 형태로 정규화"""
        import re
        
        # 동그라미 숫자를 일반 숫자로 변환
        circle_to_num = {
            '①': '1', '②': '2', '③': '3', '④': '4', '⑤': '5',
            '⑥': '6', '⑦': '7', '⑧': '8', '⑨': '9', '⑩': '10'
        }
        clean_region = region_str.strip()
        for circle, num in circle_to_num.items():
            clean_region = clean_region.replace(circle, num)
        
        # '서1울' → '서울1' 형태로 변환
        pattern = r'^([가-힣])(\d+)([가-힣]+)$'
        match = re.match(pattern, clean_region)
        
        if match:
            first_char, number, rest = match.groups()
            clean_region = f"{first_char}{rest}{number}"
        
        return clean_region

    def _is_valid_date_header(self, header_text):
        """날짜 헤더 유효성 검증 함수"""
        if not header_text or not header_text.strip():
            return False

        header_str = header_text.strip()
        
        # 빈 문자열이나 공백만 있는 경우
        if not header_str or header_str.isspace():
            return False

        # 날짜 패턴 확인 (다양한 형식 지원)
        date_patterns = [
            r'^\d{4}\.\d{1,2}$',  # YYYY.M
            r'^\d{4}-\d{1,2}$',   # YYYY-M
            r'^\d{4}/\d{1,2}$',   # YYYY/M
            r'^\d{4}\.\s*\d{1,2}$',  # YYYY. M (공백 포함)
            r'^\d{4}년\s*\d{1,2}월$',  # YYYY년 M월
            r'^\d{4}\s+\d{1,2}$'  # YYYY M (공백으로 구분)
        ]
        
        for pattern in date_patterns:
            if re.match(pattern, header_str):
                return True

        # 기타 잘못된 값 체크 (더 포괄적으로)
        invalid_patterns = [
            '구분', '지역', '평균', '전국', '기준', '합계', '총계', '소계',
            '단위', '원', '천원', '만원', '억원',
            '규격', '품목', '자재', '재료'
        ]
        
        # 가격 관련 패턴 체크 (동그라미 숫자 포함)
        price_patterns = [
            '가격', '가①격', '가②격', '가③격', '가④격', '가⑤격',
            '가⑥격', '가⑦격', '가⑧격', '가⑨격', '가⑩격'
        ]
        
        for pattern in invalid_patterns + price_patterns:
            if pattern in header_str:
                log(f"        - 잘못된 패턴으로 인식된 날짜 헤더 제외: {header_str}")
                return False
        
        # 숫자만으로 구성된 경우 (연도나 월만 있는 경우)
        if header_str.isdigit():
            # 4자리 숫자는 연도로 인정
            if len(header_str) == 4 and 1900 <= int(header_str) <= 2100:
                return True
            # 1-2자리 숫자는 월로 인정
            elif len(header_str) <= 2 and 1 <= int(header_str) <= 12:
                return True
            else:
                return False

        return False

    def _format_date_header(self, header_text):
        """날짜 헤더를 YYYY-MM-01 형식으로 변환"""
        if not header_text or not header_text.strip():
            return header_text
            
        header_str = header_text.strip()
        
        # 다양한 날짜 형식 패턴 처리
        date_patterns = [
            (r'^(\d{4})\.(\d{1,2})$', '-'),  # YYYY.M
            (r'^(\d{4})-(\d{1,2})$', '-'),   # YYYY-M
            (r'^(\d{4})/(\d{1,2})$', '-'),   # YYYY/M
            (r'^(\d{4})\.\s*(\d{1,2})$', '-'),  # YYYY. M (공백 포함)
            (r'^(\d{4})년\s*(\d{1,2})월$', '-'),  # YYYY년 M월
            (r'^(\d{4})\s+(\d{1,2})$', '-')  # YYYY M (공백으로 구분)
        ]
        
        for pattern, separator in date_patterns:
            match = re.match(pattern, header_str)
            if match:
                year = match.group(1)
                month = match.group(2).zfill(2)  # 월을 2자리로 패딩
                formatted_date = f"{year}-{month}-01"
                # 로그 간소화: 첫 번째 변환만 로그 출력
                if not hasattr(self, '_date_conversion_logged'):
                    log(f"        - 날짜 헤더 변환 예시: {header_str} -> {formatted_date}")
                    self._date_conversion_logged = True
                return formatted_date
        
        # 숫자만으로 구성된 경우 처리
        if header_str.isdigit():
            # 4자리 숫자는 연도로 처리 (1월로 설정)
            if len(header_str) == 4 and 1900 <= int(header_str) <= 2100:
                formatted_date = f"{header_str}-01-01"
                return formatted_date
            # 1-2자리 숫자는 월로 처리 (현재 연도 사용)
            elif len(header_str) <= 2 and 1 <= int(header_str) <= 12:
                current_year = datetime.now().year
                month = header_str.zfill(2)
                formatted_date = f"{current_year}-{month}-01"
                return formatted_date
        
        # 변환 실패 시 원본 반환 (로그 생략)
        return header_text

    def _is_valid_region_name(self, region_name):
        """지역명 유효성 검증 함수 - '서울1', '부산2' 형태 허용"""
        if not region_name or not region_name.strip():
            return False

        region_str = region_name.strip()
        
        # 빈 문자열이나 공백만 있는 경우
        if not region_str or region_str.isspace():
            return False

        # 한국 지역명 패턴 확인 (더 포괄적으로)
        valid_regions = [
            '강원', '경기', '경남', '경북', '광주', '대구', '대전', '부산',
            '서울', '세종', '울산', '인천', '전남', '전북', '제주', '충남', '충북',
            '수원', '성남', '춘천'  # 추가 지역명
        ]

        # 숫자가 포함된 지역명도 허용 (예: 서울1, 부산2)
        # 새로운 패턴: 지역명 + 숫자 (서울1, 부산2 등)
        for region in valid_regions:
            if region in region_str:
                # 지역명이 포함되어 있고, 숫자가 뒤에 오는 패턴 허용
                pattern = f"{region}\\d*$"
                if re.search(pattern, region_str):
                    return True
                # 기존 패턴도 허용 (지역명만)
                if region_str == region:
                    return True

        # 날짜 패턴이 포함된 경우 지역명이 아님 (더 엄격하게)
        date_patterns = [
            r'\d{4}[./-]\d{1,2}',  # YYYY.M, YYYY/M, YYYY-M
            r'\d{4}\.\s*\d{1,2}',  # YYYY. M (공백 포함)
            r'^\d{4}$',  # 연도만
            r'^\d{1,2}$',  # 월만
            r'^\d{4}년',  # YYYY년
            r'^\d{1,2}월'  # M월
        ]
        
        for pattern in date_patterns:
            if re.search(pattern, region_str):
                # 로그 최적화: 날짜 패턴 제외 로그 생략
                return False

        # 기타 잘못된 값 체크 (더 포괄적으로)
        invalid_patterns = [
            '구분', '평균', '전국', '기준', '합계', '총계', '소계',
            '단위', '원', '천원', '만원', '억원',
            '년', '월', '일', '기간',
            '-', '/', '\\', '|', '+', '='
        ]
        
        for pattern in invalid_patterns:
            if pattern in region_str:
                # 로그 최적화: 잘못된 패턴 제외 로그 생략
                return False
        
        # 숫자만으로 구성된 경우 제외
        if region_str.isdigit():
            return False
        
        # 특수문자만으로 구성된 경우 제외
        if not re.search(r'[가-힣a-zA-Z]', region_str):
            return False

        return True

    def _is_valid_date_value(self, date_value):
        """날짜 값이 유효한지 확인"""
        if date_value is None:
            return False

        # datetime 객체인 경우 유효
        if hasattr(date_value, 'strftime'):
            return True

        # 문자열인 경우 검증
        if isinstance(date_value, str):
            # 동그라미 숫자나 특수문자가 포함된 경우 제외
            circle_chars = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩']
            if any(char in date_value for char in circle_chars):
                return False

            # '가격' 등의 텍스트가 포함된 경우 제외
            if any(char in date_value for char in ['가', '격', '구', '분']):
                return False

            # 'YYYY-MM-DD' 형태 확인
            if re.match(r'^\d{4}-\d{2}-\d{2}$', date_value.strip()):
                return True

            # 'YYYY. M' 형태 확인
            date_pattern = r'^\d{4}\.\s*\d{1,2}$'
            if re.match(date_pattern, date_value.strip()):
                return True

        return False

    def _is_valid_price(self, price_str):
        """가격 데이터 유효성 검증 - 변형된 형태 포함"""
        if not price_str:
            return False
        
        price_stripped = price_str.strip()
        if (not price_stripped or 
            price_stripped == '-' or 
            price_stripped == ''):
            return False
        
        # 변형된 가격 컬럼명 처리 ('가①격', '가②격' 등)
        # 숫자와 특수문자가 포함된 가격 헤더는 제외
        if any(char in price_stripped for char in ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩']):
            return False
        
        # 한글이 포함된 경우 제외 (헤더일 가능성)
        if any('\u3131' <= char <= '\u3163' or '\uac00' <= char <= '\ud7a3' for char in price_stripped):
            return False
        
        # 영문자가 포함된 경우 제외 (헤더일 가능성)
        if any(char.isalpha() for char in price_stripped):
            return False
            
        clean_price = price_stripped.replace(',', '')
        try:
            float(clean_price)
            return True
        except ValueError:
            return False

    async def _process_specs_parallel(self, spec_list, raw_item_data,
                                     major_name, middle_name, sub_name,
                                     sub_url):
        """여러 규격을 병렬로 처리하는 메서드"""
        semaphore = asyncio.Semaphore(2)  # 최대 2개 동시 처리

        async def process_spec_with_new_page(spec):
            async with semaphore:
                try:
                    # 새로운 페이지 생성
                    new_page = await self.context.new_page()
                    base_url = "https://www.kpi.or.kr/www/price/"
                    await new_page.goto(f"{base_url}{sub_url}")
                    await new_page.wait_for_load_state(
                        'networkidle', timeout=60000)
                    await new_page.wait_for_selector(
                        'body', timeout=5000)

                    # '물가추이 보기' 탭으로 이동 (재시도 로직)
                    for retry in range(3):
                        try:
                            # 탭이 존재하는지 먼저 확인
                            await new_page.wait_for_selector('a:has-text("물가추이 보기")', timeout=15000)
                            
                            link_name = '물가추이 보기'
                            link_locator = new_page.get_by_role(
                                'link', name=link_name)
                            await link_locator.click(timeout=30000)
                            await new_page.wait_for_selector(
                                "#ITEM_SPEC_CD", timeout=30000)
                            break
                        except Exception as e:
                            if retry == 2:
                                raise e
                            log(f"물가추이 보기 탭 클릭 재시도 {retry + 1}/3: {e}", "WARNING")
                            await new_page.reload()
                            await new_page.wait_for_load_state(
                                'domcontentloaded', timeout=10000)
                            await new_page.wait_for_load_state(
                                'networkidle', timeout=30000)

                    # 임시 데이터 구조
                    temp_data = {
                        'major_category_name': major_name,
                        'middle_category_name': middle_name,
                        'sub_category_name': sub_name,
                        'spec_data': []
                    }

                    # 규격 처리
                    await self._process_single_spec(new_page, spec, temp_data)

                    await new_page.close()
                    return temp_data['spec_data']

                except Exception as e:
                    error_msg = (f"    - 병렬 처리 중 규격 '{spec['name']}' 오류 "
                                f"[대분류: {major_name}, 중분류: {middle_name}, "
                                f"소분류: {sub_name}]: {str(e)}")
                    log(error_msg)
                    return []

        # 모든 규격을 병렬로 처리
        # 모든 규격에 대한 병렬 처리 태스크 생성
        tasks = [process_spec_with_new_page(spec)
                 for spec in spec_list]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # 결과 병합
        for result in results:
            if isinstance(result, list) and result:
                raw_item_data['spec_data'].extend(result)

    async def _process_single_spec(self, page, spec, raw_item_data):
        """단일 규격에 대한 데이터 처리"""
        spec_value = spec['value']
        spec_name = spec['name']
        log(f"    - 규격: '{spec_name}' 조회 중...")

        max_retries = 3
        for attempt in range(max_retries):
            try:
                # 규격 선택
                # 규격 선택
                spec_locator = page.locator('#ITEM_SPEC_CD')
                await spec_locator.select_option(value=spec_value)
                await page.wait_for_load_state(
                    'networkidle', timeout=10000)

                # 기간 선택
                year_locator = page.locator('#DATA_YEAR_F')
                await year_locator.select_option(value=self.start_year)
                month_locator = page.locator('#DATA_MONTH_F')
                await month_locator.select_option(
                    value=self.start_month)
                await page.wait_for_load_state(
                    'networkidle', timeout=10000)

                # 검색 버튼 클릭 (재시도 로직 추가)
                search_selector = 'form[name="sForm"] input[type="image"]'
                search_button = page.locator(search_selector)
                
                # 재시도 로직 (최대 3회 시도)
                for search_attempt in range(3):
                    try:
                        await search_button.click(timeout=15000)
                        await page.wait_for_load_state(
                            'networkidle', timeout=20000)
                        break
                    except Exception as search_e:
                        if search_attempt == 2:  # 마지막 시도
                            raise search_e
                        log(f"        - 검색 버튼 클릭 실패 (시도 {search_attempt + 1}/3), 2초 후 재시도...")
                        await asyncio.sleep(2)
                break

            except Exception as e:
                if attempt < max_retries - 1:
                    attempt_num = attempt + 1
                    log(f"    - 규격 '{spec_name}' 시도 {attempt_num} "
                        f"실패, 재시도 중...")
                    await page.wait_for_timeout(1000)
                    continue
                else:
                    log(f"    - 규격 '{spec_name}' 최종 실패: "
                        f"{str(e)}")
                    return

        # 데이터 테이블 파싱
        try:
            # 재시도 로직으로 테이블 대기 (최대 3회 시도)
            for table_attempt in range(3):
                try:
                    await page.wait_for_selector(
                        "#priceTrendDataArea tr", timeout=15000)
                    break
                except Exception as table_e:
                    if table_attempt == 2:  # 마지막 시도
                        raise table_e
                    log(f"        - 테이블 로딩 실패 (시도 {table_attempt + 1}/3), 2초 후 재시도...")
                    await asyncio.sleep(2)

            # 전체 테이블 HTML을 로그로 출력해서 구조 확인
            table_html = await page.locator("#priceTrendDataArea").inner_html()
            log(f"    - 규격 '{spec_name}': 테이블 HTML 구조:\n{table_html[:500]}...")

            header_elements = await page.locator(
            "#priceTrendDataArea th").all()
            if not header_elements:
                log(f"    - 규격 '{spec_name}': 데이터 테이블을 찾을 수 없음")
                return

            # 첫 번째 헤더는 '구분'이므로 제외
            dates = [await h.inner_text() for h in header_elements[1:]]
            log(f"    - 규격 '{spec_name}': 헤더 데이터 = {dates}")

            # 첫 번째 지역 데이터 행만 추출 (예: '서①울')
            data_rows = await page.locator("#priceTrendDataArea tr").all()
            log(f"    - 규격 '{spec_name}': 총 {len(data_rows)}개 행 발견")
            if len(data_rows) < 2:
                log(f"    - 규격 '{spec_name}': 데이터 행을 찾을 수 없음")
                return

            first_row_tds = await data_rows[1].locator("td").all()
            if not first_row_tds:
                log(f"    - 규격 '{spec_name}': 데이터 셀을 찾을 수 없음")
                return

            region = await first_row_tds[0].inner_text()
            prices = [await td.inner_text() for td in first_row_tds[1:]]
            log(f"    - 규격 '{spec_name}': 지역 = {region}, "
                f"가격 데이터 = {prices}")

            # 헤더 정보 추출 (테이블 구조 파악용)
            header_cells = await data_rows[0].locator("th").all()
            headers = []
            for i in range(1, len(header_cells)):  # 첫 번째 컬럼(구분) 제외
                header_text = await header_cells[i].inner_text()
                # 동그라미 숫자를 일반 숫자로 변환 (①②③④⑤⑥⑦⑧⑨⑩ 등 -> 1,2,3)
                circle_to_num = {
                    '①': '1', '②': '2', '③': '3', '④': '4', '⑤': '5',
                    '⑥': '6', '⑦': '7', '⑧': '8', '⑨': '9', '⑩': '10'
                }
                cleaned_header = header_text.strip()
                for circle, num in circle_to_num.items():
                    cleaned_header = cleaned_header.replace(circle, num)

                # 날짜 형식 검증
                # (YYYY.M 또는 YYYY. M 형태만 허용)
                if self._is_valid_date_header(cleaned_header):
                    headers.append(cleaned_header)
                else:
                    log(f"    - 잘못된 날짜 헤더 제외: "
                        f"'{cleaned_header}' (원본: '{header_text}')")

            log(f"    - 규격 '{spec_name}': "
                f"헤더 데이터 = {headers}")

            price_list = []
            # 테이블 구조 분석: 헤더가 날짜이고 행이 지역별 데이터인 구조
            # 각 지역(행)에 대해 처리
            # 헤더 제외하고 모든 행 처리
            for i in range(1, len(data_rows)):
                try:
                    row_tds = await data_rows[i].locator("td").all()
                    if len(row_tds) >= 2:
                        # 첫 번째 컬럼은 지역명
                        region_str = await row_tds[0].inner_text()
                        # 동그라미 숫자를 일반 숫자로 변환 (①②③ 등 -> 1,2,3)
                        circle_to_num = {
                            '①': '1', '②': '2', '③': '3', '④': '4',
                            '⑤': '5', '⑥': '6', '⑦': '7', '⑧': '8',
                            '⑨': '9', '⑩': '10'
                        }
                        clean_region = region_str.strip()
                        for circle, num in circle_to_num.items():
                            clean_region = clean_region.replace(
                                circle, num)

                        # 각 날짜별 가격 처리
                        for j, date_header in enumerate(headers):
                            if j + 1 < len(row_tds):
                                price_str = await row_tds[j + 1].inner_text()
                                # 가격 데이터 유효성 검증 강화
                                price_stripped = price_str.strip()
                                if price_stripped and price_stripped != '-':
                                    # 쉼표가 포함된 숫자인지 확인
                                    clean_price = price_stripped.replace(
                                        ',', '')
                                    is_valid_price = (
                                        clean_price.isdigit() and
                                        int(clean_price) > 0)
                                    if is_valid_price:
                                        # 날짜 파싱 (YYYY. M 형태)
                                        try:
                                            is_valid_header = (
                                                self._is_valid_date_header(
                                                    date_header))
                                            if is_valid_header:
                                                year_month = (
                                                    date_header.strip()
                                                    .replace(' ', ''))
                                                if '.' in year_month:
                                                    year, month = year_month.split('.')
                                                    date_obj = datetime(
                                                        int(year),
                                                        int(month), 1)
                                                    price_data = {
                                                        'date': date_obj,
                                                        'region': clean_region,
                                                        'price': price_str.strip()
                                                    }
                                                    price_list.append(price_data)
                                                    # 유효한 가격 데이터 추가 로그
                                                    log(
                                                        f"    - 유효한 가격 데이터 추가: "
                                                        f"{clean_region} "
                                                        f"({date_header}) = "
                                                        f"{price_str.strip()}")
                                            else:
                                                # 잘못된 날짜 형식 제외 로그
                                                log(
                                                    f"    - 잘못된 날짜 형식 제외: "
                                                    f"{date_header}")
                                        except Exception as date_parse_error:
                                            # 날짜 파싱 오류 로그
                                            log(
                                                f"    - 날짜 파싱 오류: "
                                                f"{date_header} - "
                                                f"{str(date_parse_error)}")
                except Exception as row_error:
                    # 행 파싱 오류 로그
                    log(f"    - 행 {i} 파싱 오류: {str(row_error)}")
                    continue

            if price_list:
                raw_item_data['spec_data'].append({
                    'specification_name': spec_name,
                    'prices': price_list
                })
                log(f"    - 규격 '{spec_name}': {len(price_list)}개 가격 데이터 수집 완료")
            else:
                log(f"    - 규격 '{spec_name}': 유효한 가격 데이터 없음")

        except Exception as e:
            log(f"    - 규격 '{spec_name}' 데이터 파싱 오류: {str(e)}")
            return


# --- 4. 메인 실행 함수 ---
# <<< 파일 맨 아래 부분을 이 코드로 전체 교체 (5/5) >>>

async def main():
    """메인 실행 로직: 명령행 인자 파싱 및 크롤러 실행"""
    # GitHub Actions 환경에 최적화된 인자 파싱 방식
    # 예: --major="공통자재"
    args = {arg.split('=')[0].strip('-'): arg.split('=')[1].strip('"\'') for arg in sys.argv[1:] if '=' in arg}
    
    target_major = args.get('major')
    start_year = args.get('start-year', '2020')
    start_month = args.get('start-month', '01').zfill(2)

    # --major 인자가 없으면 전체 대분류 크롤링
    if not target_major:
        log("--major 인자가 없습니다. 전체 대분류를 크롤링합니다.", "INFO")
        all_major_categories = list(KpiCrawler.INCLUSION_LIST.keys())
        log(f"크롤링할 대분류: {all_major_categories}", "INFO")
        
        for major in all_major_categories:
            log(f"=== {major} 크롤링 시작 ===", "SUMMARY")
            crawler = KpiCrawler(target_major=major, start_year=start_year, start_month=start_month)
            await crawler.run()
            log(f"🟢 {major} 크롤링 완료", "SUCCESS")
        
        log("🟢 전체 대분류 크롤링 완료", "SUCCESS")
        return

    log(f"'{target_major}' 대분류 크롤링 시작 (시작 날짜: {start_year}-{start_month})", "SUMMARY")
    crawler = KpiCrawler(target_major=target_major, start_year=start_year, start_month=start_month)
    await crawler.run()
    log(f"🟢 '{target_major}' 대분류 크롤링 완료.", "SUCCESS")


if __name__ == "__main__":
    running_crawlers = check_running_crawler()
    if running_crawlers:
        log(f"이미 실행 중인 크롤러 {len(running_crawlers)}개 발견. 기존 크롤러 완료 후 재실행하세요.", "ERROR")
        sys.exit(1)
    
    asyncio.run(main())
