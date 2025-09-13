'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Plus,
  Minus,
  Trash2,
  Download,
  Undo2,
  Redo2,
  Box,
  Layers,
  Settings,
  Grid,
  Beaker,
  Flame,
  Wrench,
  Bolt,
  X,
  ZoomIn,
  ZoomOut,
  ChevronDown,
  Circle,
  Square,
  Triangle,
  Hexagon,
  Zap,
  Gauge,
  Thermometer,
  Droplets,
  Wind,
  RotateCcw,
  Filter,
  Cylinder,
  Disc,
  Pipette,
  Undo,
  Redo
} from 'lucide-react';

interface Point {
  x: number;
  y: number;
}

interface PipeSegment {
  id: string;
  start: Point;
  end: Point;
  type: 'horizontal' | 'vertical' | 'diagonal';
  size: string;
  material: string;
  tag?: string;
}

interface Equipment {
  id: string;
  type: string;
  subtype: string;
  position: Point;
  size: string;
  tag: string;
  material: string;
  rotation: number;
}

interface BOMItem {
  id: string;
  tag: string;
  description: string;
  material: string;
  size: string;
  quantity: number;
  weight?: number;
  cost?: number;
}

// 자재 라이브러리 정의
const MATERIAL_LIBRARY = {
  pipes: {
    name: '배관',
    items: [
      { id: 'pipe-straight', name: '직관', icon: Pipette },
      { id: 'pipe-bend', name: '벤드', icon: RotateCcw },
      { id: 'pipe-reducer', name: '리듀서', icon: Triangle }
    ]
  },
  fittings: {
    name: '피팅',
    items: [
      { id: 'elbow-90', name: '90° 엘보', icon: RotateCcw },
      { id: 'elbow-45', name: '45° 엘보', icon: RotateCcw },
      { id: 'tee', name: '티', icon: Wrench },
      { id: 'cross', name: '크로스', icon: Plus },
      { id: 'cap', name: '캡', icon: Circle },
      { id: 'coupling', name: '커플링', icon: Cylinder },
      { id: 'union', name: '유니온', icon: Disc },
      { id: 'flange', name: '플랜지', icon: Bolt }
    ]
  },
  valves: {
    name: '밸브',
    items: [
      { id: 'gate-valve', name: '게이트 밸브', icon: Square },
      { id: 'globe-valve', name: '글로브 밸브', icon: Circle },
      { id: 'ball-valve', name: '볼 밸브', icon: Circle },
      { id: 'butterfly-valve', name: '버터플라이 밸브', icon: Hexagon },
      { id: 'check-valve', name: '체크 밸브', icon: Triangle },
      { id: 'relief-valve', name: '릴리프 밸브', icon: Zap },
      { id: 'control-valve', name: '제어 밸브', icon: Settings }
    ]
  },
  equipment: {
    name: '설비',
    items: [
      { id: 'tank-vertical', name: '수직 탱크', icon: Cylinder },
      { id: 'tank-horizontal', name: '수평 탱크', icon: Cylinder },
      { id: 'pump-centrifugal', name: '원심 펌프', icon: Settings },
      { id: 'pump-positive', name: '용적 펌프', icon: Settings },
      { id: 'compressor', name: '압축기', icon: Wind },
      { id: 'heat-exchanger', name: '열교환기', icon: Thermometer },
      { id: 'column', name: '칼럼', icon: Cylinder },
      { id: 'reactor', name: '반응기', icon: Beaker },
      { id: 'filter', name: '필터', icon: Filter },
      { id: 'separator', name: '분리기', icon: Layers }
    ]
  },
  instruments: {
    name: '계기',
    items: [
      { id: 'pressure-gauge', name: '압력계', icon: Gauge },
      { id: 'temperature-gauge', name: '온도계', icon: Thermometer },
      { id: 'flow-meter', name: '유량계', icon: Droplets },
      { id: 'level-gauge', name: '레벨계', icon: Layers },
      { id: 'control-valve', name: '제어밸브', icon: Settings }
    ]
  }
};

const ISOPipingEditor: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState<string>('select');
  const [pipes, setPipes] = useState<PipeSegment[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [bomItems, setBomItems] = useState<BOMItem[]>([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [currentPipeSize, setCurrentPipeSize] = useState('4"');
  const [currentMaterial, setCurrentMaterial] = useState('CS');
  const [gridSize] = useState(40);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [tempLine, setTempLine] = useState<{ start: Point; end: Point } | null>(null);
  const [lastPoint, setLastPoint] = useState<Point | null>(null);
  const [currentMousePos, setCurrentMousePos] = useState<Point | null>(null);
  // 선택된 카테고리 상태 (현재 미사용)
  // const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [openDropdown, setOpenDropdown] = useState<string>('');
  // 가격 관련 상태 (현재 미사용)
  // const [materialPrices, setMaterialPrices] = useState<Record<string, number>>({});
  // const [isLoadingPrices, setIsLoadingPrices] = useState(false);
  
  // 되돌리기/다시하기 시스템
  const [history, setHistory] = useState<{
    pipes: PipeSegment[];
    equipment: Equipment[];
    bomItems: BOMItem[];
  }[]>([{ pipes: [], equipment: [], bomItems: [] }]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // ISO 그리드 각도 (30도, 90도, 150도) - 현재 미사용
  // const isoAngles = [0, 30, 90, 150, 180, 210, 270, 330];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const context = canvas.getContext('2d');
      setCtx(context);
      
      // 캔버스 크기 설정
      const resizeCanvas = () => {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        context?.scale(window.devicePixelRatio, window.devicePixelRatio);
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
      };
      
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);
      
      return () => {
        window.removeEventListener('resize', resizeCanvas);
      };
    }
  }, []);

  // 캔버스 다시 그리기 (상태 변경 시)
  useEffect(() => {
    draw();
  }, [ctx, pipes, equipment, tempLine, currentMousePos, currentTool, zoom, pan, showGrid, selectedItems]);

  // 아이소메트릭 그리드 스냅 함수 (표준 아이소메트릭 각도 기반)
  const snapToGridPoint = (point: Point): Point => {
    if (!snapToGrid) return point;
    
    // 표준 아이소메트릭 그리드의 기본 벡터 (30°, 90°, 150°)
    const u = { x: Math.cos(30 * Math.PI / 180), y: -Math.sin(30 * Math.PI / 180) };   // 30도 벡터
    const v = { x: 0, y: 1 };                                                          // 90도 벡터 (수직)
    
    // 점을 아이소메트릭 좌표계로 변환
    // P = a*u + b*v 형태로 표현
    // x = a * cos(30°)
    // y = -a * sin(30°) + b
    // 따라서: a = x / cos(30°), b = y + a * sin(30°)
    
    const cos30 = Math.cos(30 * Math.PI / 180);
    const sin30 = Math.sin(30 * Math.PI / 180);
    
    const a = point.x / cos30;
    const b = point.y + a * sin30;
    
    // 아이소메트릭 그리드에 스냅
    const snappedA = Math.round(a / gridSize) * gridSize;
    const snappedB = Math.round(b / gridSize) * gridSize;
    
    // 다시 직교 좌표계로 변환
    const snappedX = snappedA * u.x;
    const snappedY = snappedA * u.y + snappedB * v.y;
    
    return {
      x: snappedX,
      y: snappedY
    };
  };

  // ISO 각도로 스냅 (30도, 90도, 150도만 허용) - 개선된 버전
  const snapToISOAngle = useCallback((start: Point, end: Point): Point => {
    if (!snapToGrid) return end;
    
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const angle = Math.atan2(-dy, dx) * 180 / Math.PI; // Y축 반전 (캔버스 좌표계)
    
    // 아이소메트릭 표준 각도: 30도, 90도, 150도
    const isoAngles = [30, 90, 150];
    
    // 각도를 0-360 범위로 정규화
    let normalizedAngle = angle;
    if (normalizedAngle < 0) normalizedAngle += 360;
    
    // 가장 가까운 아이소메트릭 각도 찾기
    let closestAngle = isoAngles[0];
    let minDiff = Math.abs(normalizedAngle - closestAngle);
    
    for (const isoAngle of isoAngles) {
      let diff = Math.abs(normalizedAngle - isoAngle);
      // 360도 경계 처리
      if (diff > 180) {
        diff = 360 - diff;
      }
      if (diff < minDiff) {
        minDiff = diff;
        closestAngle = isoAngle;
      }
    }
    
    // 그리드에 맞춰 거리 조정
    const distance = Math.sqrt(dx * dx + dy * dy);
    const gridDistance = Math.round(distance / gridSize) * gridSize;
    const radians = closestAngle * Math.PI / 180;
    
    const newEnd = {
      x: start.x + gridDistance * Math.cos(radians),
      y: start.y - gridDistance * Math.sin(radians) // Y축 반전
    };
    
    // 최종 결과를 그리드에 스냅
    return snapToGridPoint(newEnd);
  }, [snapToGrid, gridSize, snapToGridPoint]);
  
  // 히스토리 저장 함수
  const saveToHistory = () => {
    const newState = {
      pipes: [...pipes],
      equipment: [...equipment],
      bomItems: [...bomItems]
    };
    
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);
    
    // 히스토리 크기 제한 (최대 50개)
    if (newHistory.length > 50) {
      newHistory.shift();
    } else {
      setHistoryIndex(historyIndex + 1);
    }
    
    setHistory(newHistory);
  };
  
  // 되돌리기 함수
  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const state = history[newIndex];
      
      setPipes(state.pipes);
      setEquipment(state.equipment);
      setBomItems(state.bomItems);
      setHistoryIndex(newIndex);
    }
  };
  
  // 다시하기 함수
  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const state = history[newIndex];
      
      setPipes(state.pipes);
      setEquipment(state.equipment);
      setBomItems(state.bomItems);
      setHistoryIndex(newIndex);
    }
  };

  // 캔버스 그리기
  const draw = () => {
    if (!ctx || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const { width, height } = canvas.getBoundingClientRect();
    
    // 캔버스 클리어
    ctx.clearRect(0, 0, width, height);
    
    // 변환 적용
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(pan.x, pan.y);
    
    // ISO 그리드 그리기 (showGrid가 true일 때만)
    if (showGrid) {
      drawISOGrid(ctx, width, height);
    }
    
    // 배관 그리기
    pipes.forEach(pipe => drawPipe(ctx, pipe));
    
    // 장비 그리기
    equipment.forEach(eq => drawEquipment(ctx, eq));
    
    // 임시 라인 그리기 (그리기 중일 때) - ISO 스타일
    if (tempLine && isDrawing && currentTool === 'pipe') {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 3 / zoom;
      ctx.setLineDash([8 / zoom, 4 / zoom]);
      ctx.lineCap = 'round';
      
      // 메인 임시 라인
      ctx.beginPath();
      ctx.moveTo(tempLine.start.x, tempLine.start.y);
      ctx.lineTo(tempLine.end.x, tempLine.end.y);
      ctx.stroke();
      
      // 임시 라인의 외곽선 (미리보기)
      if (zoom > 0.4) {
        const dx = tempLine.end.x - tempLine.start.x;
        const dy = tempLine.end.y - tempLine.start.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length > 0) {
          const unitX = dx / length;
          const unitY = dy / length;
          const perpX = -unitY * (4 / zoom);
          const perpY = unitX * (4 / zoom);
          
          ctx.strokeStyle = '#60a5fa';
          ctx.lineWidth = 1 / zoom;
          ctx.setLineDash([4 / zoom, 2 / zoom]);
          
          // 상단 라인
          ctx.beginPath();
          ctx.moveTo(tempLine.start.x + perpX, tempLine.start.y + perpY);
          ctx.lineTo(tempLine.end.x + perpX, tempLine.end.y + perpY);
          ctx.stroke();
          
          // 하단 라인
          ctx.beginPath();
          ctx.moveTo(tempLine.start.x - perpX, tempLine.start.y - perpY);
          ctx.lineTo(tempLine.end.x - perpX, tempLine.end.y - perpY);
          ctx.stroke();
        }
      }
      
      // 시작점과 끝점 표시
      ctx.fillStyle = '#3b82f6';
      ctx.setLineDash([]);
      
      // 시작점
      ctx.beginPath();
      ctx.arc(tempLine.start.x, tempLine.start.y, 4 / zoom, 0, 2 * Math.PI);
      ctx.fill();
      
      // 끝점 (더 크게)
      ctx.beginPath();
      ctx.arc(tempLine.end.x, tempLine.end.y, 6 / zoom, 0, 2 * Math.PI);
      ctx.fill();
      
      // 길이 표시
      if (zoom > 0.6) {
        const midX = (tempLine.start.x + tempLine.end.x) / 2;
        const midY = (tempLine.start.y + tempLine.end.y) / 2;
        const distance = Math.sqrt(
          Math.pow(tempLine.end.x - tempLine.start.x, 2) + 
          Math.pow(tempLine.end.y - tempLine.start.y, 2)
        );
        const lengthInMeters = (distance / 100).toFixed(1); // 픽셀을 미터로 변환
        
        ctx.fillStyle = 'rgba(59, 130, 246, 0.9)';
        ctx.font = `bold ${12 / zoom}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(`${lengthInMeters}m`, midX, midY - 10 / zoom);
      }
      
      ctx.setLineDash([]);
    }
    
    // 배관 도구 선택 시 현재 마우스 위치에 임시 점 표시
    if (currentTool === 'pipe' && currentMousePos) {
      ctx.fillStyle = '#ef4444'; // 빨간색 점
      ctx.strokeStyle = '#ffffff'; // 흰색 테두리
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([]);
      
      // 메인 점
      ctx.beginPath();
      ctx.arc(currentMousePos.x, currentMousePos.y, 5 / zoom, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      
      // 십자 표시 (그리드 교차점 강조)
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1 / zoom;
      const crossSize = 8 / zoom;
      
      // 수평선
      ctx.beginPath();
      ctx.moveTo(currentMousePos.x - crossSize, currentMousePos.y);
      ctx.lineTo(currentMousePos.x + crossSize, currentMousePos.y);
      ctx.stroke();
      
      // 수직선
      ctx.beginPath();
      ctx.moveTo(currentMousePos.x, currentMousePos.y - crossSize);
      ctx.lineTo(currentMousePos.x, currentMousePos.y + crossSize);
      ctx.stroke();
    }
    
    ctx.restore();
  };

  // ISO 아이소메트릭 그리드 그리기 (30도 각도)
  const drawISOGrid = (context: CanvasRenderingContext2D, width: number, height: number) => {
    context.strokeStyle = '#e5e7eb';
    context.lineWidth = 0.5 / zoom; // 줌에 따라 선 두께 조정
    
    // 줌 레벨에 따라 그리드 간격 조정 (더 넓은 범위 지원)
    let displayGridSize = gridSize;
    if (zoom < 0.25) {
      displayGridSize = gridSize * 8;
    } else if (zoom < 0.5) {
      displayGridSize = gridSize * 4;
    } else if (zoom < 0.8) {
      displayGridSize = gridSize * 2;
    }
    
    // 화면 좌표를 월드 좌표로 변환 (여유분 추가)
    const margin = displayGridSize * 5; // 여유분 추가로 그리드 사라짐 방지
    const worldStartX = -pan.x - margin;
    const worldStartY = -pan.y - margin;
    const worldEndX = worldStartX + width / zoom + margin * 2;
    const worldEndY = worldStartY + height / zoom + margin * 2;
    
    // 아이소메트릭 그리드의 기본 벡터 (표준 아이소메트릭 각도)
    const isoVectors = [
      { dx: Math.cos(30 * Math.PI / 180), dy: -Math.sin(30 * Math.PI / 180) },   // 30도 (우측 축)
      { dx: 0, dy: 1 },                                                          // 90도 (수직 축)
      { dx: Math.cos(150 * Math.PI / 180), dy: -Math.sin(150 * Math.PI / 180) } // 150도 (좌측 축)
    ];
    
    // 각 방향별로 선 그리기
    isoVectors.forEach((vector, index) => {
      const { dx, dy } = vector;
      
      // 선의 수직 벡터 계산
      const perpDx = -dy;
      const perpDy = dx;
      
      // 그리드 간격을 벡터 방향으로 조정
      const spacing = displayGridSize / Math.sqrt(dx * dx + dy * dy);
      
      // 화면 영역을 덮는 선의 개수 계산
      const diagonal = Math.sqrt(
        (worldEndX - worldStartX) ** 2 + (worldEndY - worldStartY) ** 2
      );
      const numLines = Math.ceil(diagonal / spacing) + 10;
      
      // 중심점 계산
      const centerX = (worldStartX + worldEndX) / 2;
      const centerY = (worldStartY + worldEndY) / 2;
      
      // 선 그리기
      for (let i = -numLines; i <= numLines; i++) {
        const offset = i * spacing;
        const lineStartX = centerX + perpDx * offset;
        const lineStartY = centerY + perpDy * offset;
        
        // 선의 길이를 충분히 길게 설정
        const lineLength = diagonal;
        const x1 = lineStartX - dx * lineLength;
        const y1 = lineStartY - dy * lineLength;
        const x2 = lineStartX + dx * lineLength;
        const y2 = lineStartY + dy * lineLength;
        
        context.beginPath();
        context.moveTo(x1, y1);
        context.lineTo(x2, y2);
        context.stroke();
      }
    });
  };

  // 배관 그리기 (ISO 표준 라인)
  const drawPipe = (context: CanvasRenderingContext2D, pipe: PipeSegment) => {
    const isSelected = selectedItems.includes(pipe.id);
    context.strokeStyle = isSelected ? '#3b82f6' : '#374151';
    context.lineWidth = (isSelected ? 4 : 3) / zoom; // 더 굵은 라인
    context.lineCap = 'round';
    context.lineJoin = 'round';
    
    // 메인 배관 라인
    context.beginPath();
    context.moveTo(pipe.start.x, pipe.start.y);
    context.lineTo(pipe.end.x, pipe.end.y);
    context.stroke();
    
    // 배관 외곽선 (이중선 효과)
    if (zoom > 0.3) {
      const dx = pipe.end.x - pipe.start.x;
      const dy = pipe.end.y - pipe.start.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      
      if (length > 0) {
        const unitX = dx / length;
        const unitY = dy / length;
        const perpX = -unitY * (6 / zoom); // 수직 벡터
        const perpY = unitX * (6 / zoom);
        
        // 상단 라인
        context.strokeStyle = isSelected ? '#60a5fa' : '#6b7280';
        context.lineWidth = 1 / zoom;
        context.beginPath();
        context.moveTo(pipe.start.x + perpX, pipe.start.y + perpY);
        context.lineTo(pipe.end.x + perpX, pipe.end.y + perpY);
        context.stroke();
        
        // 하단 라인
        context.beginPath();
        context.moveTo(pipe.start.x - perpX, pipe.start.y - perpY);
        context.lineTo(pipe.end.x - perpX, pipe.end.y - perpY);
        context.stroke();
      }
    }
    
    // 배관 크기 및 재료 표시
    if (zoom > 0.5) {
      const midX = (pipe.start.x + pipe.end.x) / 2;
      const midY = (pipe.start.y + pipe.end.y) / 2;
      
      // 배경 박스
      const text = `${pipe.size} ${pipe.material}`;
      context.font = `bold ${10 / zoom}px Arial`;
      const textWidth = context.measureText(text).width;
      context.fillStyle = 'rgba(255, 255, 255, 0.8)';
      context.fillRect(
        midX - textWidth / 2 - 2 / zoom,
        midY - 15 / zoom,
        textWidth + 4 / zoom,
        12 / zoom
      );
      
      context.fillStyle = isSelected ? '#1d4ed8' : '#374151';
      context.textAlign = 'center';
      context.fillText(text, midX, midY - 8 / zoom);
      
      if (pipe.tag) {
        context.fillText(pipe.tag, midX, midY + 15 / zoom);
      }
    }
    
    // 연결점 표시
    if (zoom > 0.7) {
      context.fillStyle = isSelected ? '#3b82f6' : '#6b7280';
      
      // 시작점
      context.beginPath();
      context.arc(pipe.start.x, pipe.start.y, 3 / zoom, 0, 2 * Math.PI);
      context.fill();
      
      // 끝점
      context.beginPath();
      context.arc(pipe.end.x, pipe.end.y, 3 / zoom, 0, 2 * Math.PI);
      context.fill();
    }
  };

  // 장비 그리기
  const drawEquipment = (context: CanvasRenderingContext2D, eq: Equipment) => {
    context.save();
    context.translate(eq.position.x, eq.position.y);
    context.rotate(eq.rotation * Math.PI / 180);
    
    context.strokeStyle = '#1f2937';
    context.fillStyle = '#f3f4f6';
    context.lineWidth = 2;
    
    // 장비 타입에 따른 그리기
    const size = 30;
    switch (eq.type) {
      case 'equipment':
        if (eq.subtype.includes('tank')) {
          // 탱크
          context.beginPath();
          context.arc(0, 0, size, 0, 2 * Math.PI);
          context.fill();
          context.stroke();
        } else if (eq.subtype.includes('pump')) {
          // 펌프
          context.beginPath();
          context.arc(0, 0, size * 0.8, 0, 2 * Math.PI);
          context.fill();
          context.stroke();
          
          context.beginPath();
          context.arc(0, 0, size * 0.5, 0, 2 * Math.PI);
          context.stroke();
        } else {
          // 기본 장비
          context.beginPath();
          context.rect(-size, -size, size * 2, size * 2);
          context.fill();
          context.stroke();
        }
        break;
        
      case 'valves':
        // 밸브
        context.beginPath();
        context.rect(-size * 0.5, -size * 0.5, size, size);
        context.fill();
        context.stroke();
        
        // 밸브 스템
        context.beginPath();
        context.moveTo(0, -size * 0.5);
        context.lineTo(0, -size);
        context.stroke();
        break;
        
      default:
        // 기본 형태
        context.beginPath();
        context.rect(-size * 0.7, -size * 0.7, size * 1.4, size * 1.4);
        context.fill();
        context.stroke();
    }
    
    // 태그 표시
    context.fillStyle = '#1f2937';
    context.font = `${10 / zoom}px Arial`;
    context.textAlign = 'center';
    context.fillText(eq.tag, 0, size + 15);
    
    context.restore();
  };

  // 마우스 이벤트 처리 (개선된 버전)
  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    // 정확한 좌표 변환: 먼저 화면 좌표를 캔버스 좌표로 변환 후 줌과 팬 적용
    const rawPos = {
      x: (e.clientX - rect.left - pan.x * zoom) / zoom,
      y: (e.clientY - rect.top - pan.y * zoom) / zoom
    };
    
    // 배관 도구 선택 시 항상 그리드 스냅 적용, 그 외에는 설정에 따라
    const shouldSnap = currentTool === 'pipe' || snapToGrid;
    return shouldSnap ? snapToGridPoint(rawPos) : rawPos;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // 우클릭 처리
    if (e.button === 2) {
      e.preventDefault();
      // 배관 그리기 종료
      if (currentTool === 'pipe' && lastPoint) {
        setLastPoint(null);
        setTempLine(null);
        setIsDrawing(false);
      }
      return;
    }
    
    const pos = getMousePos(e); // 이미 스냅된 위치
    
    if (currentTool === 'pipe') {
      if (!lastPoint) {
        // 새로운 라인 시작 - 첫 번째 점 설정
        setLastPoint(pos);
        setIsDrawing(true);
      } else {
        // 현재 라인 완성
        const endPos = snapToISOAngle(lastPoint, pos);
        
        // 최소 길이 체크 (너무 짧은 라인 방지)
        const distance = Math.sqrt(
          Math.pow(endPos.x - lastPoint.x, 2) + Math.pow(endPos.y - lastPoint.y, 2)
        );
        
        if (distance > gridSize / 2) { // 그리드 크기의 절반 이상일 때만 생성
          const newPipe: PipeSegment = {
            id: `pipe-${Date.now()}`,
            start: lastPoint,
            end: endPos,
            type: 'horizontal',
            size: currentPipeSize,
            material: currentMaterial,
            tag: `P-${pipes.length + 1}`
          };
          
          setPipes(prev => [...prev, newPipe]);
          
          // BOM에 추가
          const length = distance / gridSize;
          const bomItem: BOMItem = {
            id: newPipe.id,
            tag: newPipe.tag || '',
            description: `PIPE ${newPipe.size} ${newPipe.material}`,
            material: newPipe.material,
            size: newPipe.size,
            quantity: Math.round(length * 100) / 100
          };
          
          setBomItems(prev => [...prev, bomItem]);
          
          // 히스토리에 저장
          setTimeout(() => saveToHistory(), 0);
        }
        
        // 연속 그리기를 위해 새 시작점 설정
        setLastPoint(endPos);
      }
    } else if (currentTool === 'select') {
      // 선택 도구 로직
      const clickedPipe = pipes.find(pipe => {
        const dx = pipe.end.x - pipe.start.x;
        const dy = pipe.end.y - pipe.start.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length === 0) return false;
        
        const t = Math.max(0, Math.min(1, ((pos.x - pipe.start.x) * dx + (pos.y - pipe.start.y) * dy) / (length * length)));
        const projection = {
          x: pipe.start.x + t * dx,
          y: pipe.start.y + t * dy
        };
        
        const dist = Math.sqrt(
          Math.pow(pos.x - projection.x, 2) + Math.pow(pos.y - projection.y, 2)
        );
        
        return dist < 15 / zoom;
      });
      
      const clickedEquipment = equipment.find(eq => {
        const dist = Math.sqrt(
          Math.pow(pos.x - eq.position.x, 2) + Math.pow(pos.y - eq.position.y, 2)
        );
        return dist < 30;
      });
      
      if (e.ctrlKey || e.metaKey) {
        // Ctrl/Cmd 클릭으로 다중 선택
        if (clickedPipe) {
          setSelectedItems(prev => 
            prev.includes(clickedPipe.id) 
              ? prev.filter(id => id !== clickedPipe.id)
              : [...prev, clickedPipe.id]
          );
        } else if (clickedEquipment) {
          setSelectedItems(prev => 
            prev.includes(clickedEquipment.id) 
              ? prev.filter(id => id !== clickedEquipment.id)
              : [...prev, clickedEquipment.id]
          );
        }
      } else {
        // 단일 선택
        if (clickedPipe) {
          setSelectedItems([clickedPipe.id]);
        } else if (clickedEquipment) {
          setSelectedItems([clickedEquipment.id]);
        } else {
          setSelectedItems([]);
        }
      }
    } else if (currentTool.includes('-')) {
      const [category, itemId] = currentTool.split('-', 2);
      addEquipment(category, itemId, pos);
    }
    
    setIsDrawing(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e); // 이미 스냅된 위치
    
    // 현재 마우스 위치 업데이트 (배관 도구 선택 시 스냅된 위치)
    if (currentTool === 'pipe') {
      setCurrentMousePos(pos);
    } else {
      setCurrentMousePos(null);
    }
    
    // 배관 그리기 모드에서 임시선 표시
    if (currentTool === 'pipe' && lastPoint) {
      const endPos = snapToISOAngle(lastPoint, pos);
      setTempLine({ start: lastPoint, end: endPos });
    } else if (currentTool !== 'pipe') {
      // 배관 모드가 아닐 때는 임시선 제거
      setTempLine(null);
    }
    
    // 커서 스타일 변경
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      if (currentTool === 'pipe') {
        canvas.style.cursor = isDrawing ? 'crosshair' : 'crosshair';
      } else if (currentTool === 'select') {
        // 선택 가능한 객체 위에 있는지 확인
        const clickedPipe = pipes.find(pipe => {
          const dx = pipe.end.x - pipe.start.x;
          const dy = pipe.end.y - pipe.start.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          
          if (length === 0) return false;
          
          const t = Math.max(0, Math.min(1, ((pos.x - pipe.start.x) * dx + (pos.y - pipe.start.y) * dy) / (length * length)));
          const projection = {
            x: pipe.start.x + t * dx,
            y: pipe.start.y + t * dy
          };
          
          const dist = Math.sqrt(
            Math.pow(pos.x - projection.x, 2) + Math.pow(pos.y - projection.y, 2)
          );
          
          return dist < 15 / zoom;
        });
        
        const clickedEquipment = equipment.find(eq => {
          const dist = Math.sqrt(
            Math.pow(pos.x - eq.position.x, 2) + Math.pow(pos.y - eq.position.y, 2)
          );
          return dist < 30;
        });
        
        canvas.style.cursor = (clickedPipe || clickedEquipment) ? 'pointer' : 'default';
      } else {
        canvas.style.cursor = 'default';
      }
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    setTempLine(null);
  };

  // 키보드 이벤트 처리
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ctrl+Z (되돌리기)
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
      return;
    }
    
    // Ctrl+Y 또는 Ctrl+Shift+Z (다시하기)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      redo();
      return;
    }
    
    if (e.key === 'Escape') {
      // ESC 키로 그리기 모드 취소
      if (isDrawing) {
        setIsDrawing(false);
        setLastPoint(null);
        setTempLine(null);
      }
      setSelectedItems([]);
    } else if (e.key === 'Enter' && isDrawing) {
      // Enter 키로 그리기 완료
      setIsDrawing(false);
      setLastPoint(null);
      setTempLine(null);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      // Delete/Backspace 키로 선택된 항목 삭제
      if (selectedItems.length > 0) {
        setPipes(prev => prev.filter(pipe => !selectedItems.includes(pipe.id)));
        setEquipment(prev => prev.filter(eq => !selectedItems.includes(eq.id)));
        setBomItems(prev => prev.filter(item => !selectedItems.includes(item.id)));
        setSelectedItems([]);
        
        // 삭제 후 히스토리에 저장
        setTimeout(() => saveToHistory(), 0);
      }
    } else if (e.key === 'g' || e.key === 'G') {
      // G 키로 그리드 토글
      setShowGrid(prev => !prev);
    } else if (e.key === 's' || e.key === 'S') {
      // S 키로 스냅 토글
      setSnapToGrid(prev => !prev);
    }
  }, [isDrawing, selectedItems, undo, redo, saveToHistory]);

  // 키보드 이벤트 리스너 등록
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // 장비 추가
  const addEquipment = (category: string, itemId: string, position: Point) => {
    const categoryData = MATERIAL_LIBRARY[category as keyof typeof MATERIAL_LIBRARY];
    const item = categoryData?.items.find(i => i.id === itemId);
    
    if (!item) return;
    
    const newEquipment: Equipment = {
      id: `eq-${Date.now()}`,
      type: category,
      subtype: itemId,
      position,
      size: '4"',
      tag: `${item.name}-${equipment.length + 1}`,
      material: currentMaterial,
      rotation: 0
    };
    
    setEquipment(prev => [...prev, newEquipment]);
    
    // BOM에 추가
    const bomItem: BOMItem = {
      id: newEquipment.id,
      tag: newEquipment.tag,
      description: `${item.name} ${newEquipment.size}`,
      material: newEquipment.material,
      size: newEquipment.size,
      quantity: 1
    };
    
    setBomItems(prev => [...prev, bomItem]);
    
    // 장비 추가 후 히스토리에 저장
    setTimeout(() => saveToHistory(), 0);
  };

  // BOM 가격 정보 업데이트
  const updateBOMPrices = async () => {
    try {
      // 실제 API 호출 대신 임시 가격 데이터 사용
      const prices: Record<string, number> = {
        'CS': 10.5,
        'SS': 25.0,
        'AS': 18.3,
        'PVC': 5.2,
        'HDPE': 8.7
      };
      
      // BOM 항목들의 가격 업데이트
      setBomItems(prev => prev.map(item => ({
        ...item,
        cost: prices[item.material] || 0,
        weight: item.size === '1"' ? 2.5 : 
               item.size === '2"' ? 4.2 : 
               item.size === '3"' ? 6.8 : 
               item.size === '4"' ? 9.1 : 
               item.size === '6"' ? 15.2 : 
               item.size === '8"' ? 22.5 : 
               item.size === '10"' ? 32.1 : 
               item.size === '12"' ? 45.8 : 3.0
      })));
    } catch (error) {
      console.error('가격 정보 업데이트 실패:', error);
    }
  };

  // BOM 내보내기
  const exportBOM = async () => {
    // 먼저 가격 정보 업데이트
    await updateBOMPrices();
    
    const csvContent = [
      ['MARK', 'QTY/LGTH', 'SIZE', 'DESCRIPTION', 'MATERIAL', 'UNIT_PRICE', 'TOTAL_PRICE', 'WEIGHT'],
      ...bomItems.map((item, index) => [
        (index + 1).toString(),
        item.quantity.toString(),
        item.size,
        item.description,
        item.material,
        item.cost ? `$${item.cost.toFixed(2)}` : 'N/A',
        item.cost ? `$${(item.cost * item.quantity).toFixed(2)}` : 'N/A',
        item.weight ? `${item.weight.toFixed(2)} kg` : 'N/A'
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'iso-piping-bom.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    draw();
  }, [ctx, zoom, pan, pipes, equipment, tempLine, showGrid]);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* 왼쪽 툴바 */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            ISO 배관 편집기
          </h2>
          <p className="text-sm text-gray-600">
            배관 아이소메트릭 도면
          </p>
        </div>
        
        {/* 도구 선택 */}
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-3">도구</h3>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={currentTool === 'select' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setCurrentTool('select');
                setCurrentMousePos(null);
                setLastPoint(null);
                setTempLine(null);
              }}
            >
              선택
            </Button>
            <Button
              variant={currentTool === 'pipe' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setCurrentTool('pipe');
                setLastPoint(null);
                setTempLine(null);
              }}
            >
              배관
            </Button>
          </div>
        </div>
        
        {/* 배관 설정 */}
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            배관 설정
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                사이즈
              </label>
              <select
                title="파이프 크기 선택"
                aria-label="파이프 크기 선택"
                value={currentPipeSize}
                onChange={(e) => setCurrentPipeSize(e.target.value)}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
              >
                <option value="1/4&quot;">1/4&quot;</option>
                <option value="1/2&quot;">1/2&quot;</option>
                <option value="3/4&quot;">3/4&quot;</option>
                <option value="1&quot;">1&quot;</option>
                <option value="1-1/2&quot;">1-1/2&quot;</option>
                <option value="2&quot;">2&quot;</option>
                <option value="2-1/2&quot;">2-1/2&quot;</option>
                <option value="3&quot;">3&quot;</option>
                <option value="4&quot;">4&quot;</option>
                <option value="6&quot;">6&quot;</option>
                <option value="8&quot;">8&quot;</option>
                <option value="10&quot;">10&quot;</option>
                <option value="12&quot;">12&quot;</option>
                <option value="14&quot;">14&quot;</option>
                <option value="16&quot;">16&quot;</option>
                <option value="18&quot;">18&quot;</option>
                <option value="20&quot;">20&quot;</option>
                <option value="24&quot;">24&quot;</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                재질
              </label>
              <select
                title="Select material type"
                aria-label="Material type"
                value={currentMaterial}
                onChange={(e) => setCurrentMaterial(e.target.value)}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
              >
                <option value="CS">CS (Carbon Steel)</option>
                <option value="SS">SS (Stainless Steel)</option>
                <option value="AS">AS (Alloy Steel)</option>
                <option value="PVC">PVC</option>
                <option value="HDPE">HDPE</option>
              </select>
            </div>
          </div>
        </div>
        
        {/* 자재 라이브러리 */}
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-3">자재 라이브러리</h3>
          <div className="space-y-2">
            {Object.entries(MATERIAL_LIBRARY).map(([categoryKey, category]) => (
              <div key={categoryKey} className="relative">
                <button
                  onClick={() => setOpenDropdown(openDropdown === categoryKey ? '' : categoryKey)}
                  className="w-full flex items-center justify-between p-2 text-sm bg-gray-50 hover:bg-gray-100 rounded border transition-colors"
                >
                  <span className="font-medium">{category.name}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${
                    openDropdown === categoryKey ? 'rotate-180' : ''
                  }`} />
                </button>
                
                {openDropdown === categoryKey && (
                  <div className="mt-1 bg-white border rounded shadow-lg max-h-48 overflow-y-auto">
                    {category.items.map((item) => {
                      const IconComponent = item.icon;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setCurrentTool(`${categoryKey}-${item.id}`);
                            setCurrentMousePos(null);
                            setLastPoint(null);
                            setTempLine(null);
                            setOpenDropdown('');
                          }}
                          className={`w-full flex items-center gap-2 p-2 text-sm hover:bg-blue-50 transition-colors ${
                            currentTool === `${categoryKey}-${item.id}` ? 'bg-blue-100 text-blue-700' : ''
                          }`}
                        >
                          <IconComponent className="w-4 h-4" />
                          <span>{item.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* 설정 */}
        <div className="p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">설정</h3>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={snapToGrid}
                onChange={(e) => setSnapToGrid(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-gray-600">그리드 스냅</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-gray-600">그리드 표시</span>
            </label>
          </div>
        </div>
      </div>
      
      {/* 중앙 편집 영역 */}
      <div className="flex-1 flex flex-col">
        {/* 상단 툴바 */}
        <div className="bg-white border-b border-gray-200 p-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={undo}
              disabled={historyIndex <= 0}
              title="되돌리기 (Ctrl+Z)"
            >
              <Undo className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              title="다시하기 (Ctrl+Y)"
            >
              <Redo className="w-4 h-4" />
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setZoom(prev => Math.min(prev + 0.1, 3))}
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <span className="text-sm text-gray-600 min-w-[60px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setZoom(prev => Math.max(prev - 0.1, 0.1))}
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowGrid(!showGrid)}
              className={showGrid ? 'bg-blue-50 text-blue-700' : ''}
            >
              <Grid className="w-4 h-4" />
              그리드
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              onClick={exportBOM}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              BOM 내보내기
            </Button>
          </div>
        </div>
        
        {/* 캔버스 */}
        <div className="flex-1 relative overflow-hidden">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full cursor-crosshair"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onContextMenu={(e) => e.preventDefault()}
          />
          
          {/* 상태 표시 */}
          <div className="absolute top-4 left-4 bg-white bg-opacity-90 rounded-lg p-3 shadow-lg">
            <div className="text-sm font-medium text-gray-900">
              현재 도구: {currentTool === 'select' ? '선택' : 
                        currentTool === 'pipe' ? '배관' : 
                        currentTool.includes('-') ? 
                          MATERIAL_LIBRARY[currentTool.split('-')[0] as keyof typeof MATERIAL_LIBRARY]?.items
                            .find(item => item.id === currentTool.split('-').slice(1).join('-'))?.name || currentTool
                        : currentTool}
            </div>
            <div className="text-xs text-gray-600">
              배관: {currentPipeSize} {currentMaterial}
            </div>
            {currentTool === 'pipe' && (
              <div className="text-xs text-blue-600 mt-1">
                {lastPoint ? '다음 점을 클릭하세요' : '시작점을 클릭하세요'}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* 오른쪽 BOM 패널 */}
      <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                자재 명세서 (BOM)
              </h3>
              <p className="text-sm text-gray-600">
                ISO 배관 자재 목록
              </p>
            </div>
            {bomItems.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={updateBOMPrices}
                className="text-xs"
              >
                가격 업데이트
              </Button>
            )}
          </div>
          {bomItems.length > 0 && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg">
              <div className="text-sm font-medium text-blue-900 mb-1">
                비용 요약
              </div>
              <div className="text-xs text-blue-700 space-y-1">
                <div>총 항목: {bomItems.length}개</div>
                <div>총 무게: {bomItems.reduce((sum, item) => sum + (item.weight || 0) * item.quantity, 0).toFixed(2)} kg</div>
                <div className="font-semibold text-blue-900">
                  총 비용: ${bomItems.reduce((sum, item) => sum + (item.cost || 0) * item.quantity, 0).toFixed(2)}
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {bomItems.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <Box className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">
                배관이나 장비를 추가하면<br />BOM이 자동 생성됩니다
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {bomItems.map((item, index) => (
                <div key={item.id} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-medium text-sm text-gray-900">
                      {index + 1}. {item.tag}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setBomItems(prev => prev.filter(i => i.id !== item.id));
                        setPipes(prev => prev.filter(p => p.id !== item.id));
                        setEquipment(prev => prev.filter(e => e.id !== item.id));
                      }}
                      className="text-red-500 hover:text-red-700 h-auto p-1"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="text-xs text-gray-600 space-y-1">
                    <div>설명: {item.description}</div>
                    <div>재질: {item.material}</div>
                    <div>사이즈: {item.size}</div>
                    <div>수량: {item.quantity}</div>
                    {item.cost && (
                      <div className="text-green-600 font-medium">
                        단가: ${item.cost.toFixed(2)}
                      </div>
                    )}
                    {item.weight && (
                      <div>무게: {item.weight.toFixed(2)} kg</div>
                    )}
                    {item.cost && (
                      <div className="text-blue-600 font-medium">
                        총액: ${(item.cost * item.quantity).toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ISOPipingEditor;