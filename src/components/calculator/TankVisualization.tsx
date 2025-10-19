'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface TankVisualizationProps {
  diameter: number;
  height: number;
  topHeadType: string;
  bottomHeadType: string;
}

export default function TankVisualization({ 
  diameter, 
  height, 
  topHeadType, 
  bottomHeadType 
}: TankVisualizationProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const tankGroupRef = useRef<THREE.Group | null>(null);
  const dimensionGroupRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;

    // 기존 렌더러가 있으면 정리
    if (rendererRef.current) {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      if (currentMount.contains(rendererRef.current.domElement)) {
        currentMount.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current.dispose();
    }

    // Scene 초기화
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);
    sceneRef.current = scene;

    // Camera 설정
    const camera = new THREE.PerspectiveCamera(
      50,
      currentMount.clientWidth / currentMount.clientHeight,
      0.1,
      1000
    );

    // Renderer 설정 (개선된 버전)
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;
    currentMount.appendChild(renderer.domElement);

    // 조명 설정 (개선된 버전)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    // 주 조명
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 4096;
    directionalLight.shadow.mapSize.height = 4096;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    scene.add(directionalLight);

    // 보조 조명 (림 라이트)
    const rimLight = new THREE.DirectionalLight(0x6366f1, 0.3);
    rimLight.position.set(-5, 5, -5);
    scene.add(rimLight);

    // 환경 맵핑을 위한 점광원
    const pointLight = new THREE.PointLight(0xffffff, 0.5, 100);
    pointLight.position.set(0, 10, 10);
    scene.add(pointLight);

    // 탱크 업데이트 함수
    const updateTank = () => {
      // 기존 탱크 제거
      if (tankGroupRef.current) {
        scene.remove(tankGroupRef.current);
      }
      if (dimensionGroupRef.current) {
        scene.remove(dimensionGroupRef.current);
      }

      // 새 탱크 그룹 생성
      const tankGroup = new THREE.Group();
      const dimensionGroup = new THREE.Group();
      tankGroupRef.current = tankGroup;
      dimensionGroupRef.current = dimensionGroup;

      // 스케일링 계산
      const radius = diameter / 2;
      const maxDimension = Math.max(diameter, height);
      const scaleFactor = Math.max(0.5, Math.min(3, 8 / maxDimension));
      const scaledRadius = radius * scaleFactor;
      const scaledHeight = height * scaleFactor;

      // 재질 정의 (개선된 버전)
      const tankMaterial = new THREE.MeshStandardMaterial({
        color: 0x4f46e5,
        metalness: 0.7,
        roughness: 0.2,
        transparent: false,
        opacity: 1.0
      });

      const headMaterial = new THREE.MeshStandardMaterial({
        color: 0x4f46e5, // 바디와 동일한 색상으로 통일
        metalness: 0.7,
        roughness: 0.2,
        transparent: false,
        opacity: 1.0
      });

      // 용접선 재질
      const weldMaterial = new THREE.MeshStandardMaterial({
        color: 0x6b7280,
        metalness: 0.8,
        roughness: 0.4
      });

      // 원통형 몸체 (고해상도)
      const bodyGeometry = new THREE.CylinderGeometry(
        scaledRadius, 
        scaledRadius, 
        scaledHeight, 
        64, // 더 높은 해상도
        1
      );
      const body = new THREE.Mesh(bodyGeometry, tankMaterial);
      body.castShadow = true;
      body.receiveShadow = true;
      tankGroup.add(body);

      // 용접선 추가 (헤드와 바디 연결부)
      const createWeldLine = (yPosition: number) => {
        const weldGeometry = new THREE.TorusGeometry(
          scaledRadius + scaleFactor * 0.02, 
          scaleFactor * 0.01, 
          8, 
          64
        );
        const weld = new THREE.Mesh(weldGeometry, weldMaterial);
        weld.position.y = yPosition;
        weld.rotation.x = Math.PI / 2;
        return weld;
      };

      // 헤드 생성 함수 (개선된 버전)
      const createHead = (type: string, isTop: boolean) => {
        let geometry;
        // const headHeight = scaledRadius * 0.5; // 높이 증가 (현재 미사용)
        
        switch (type) {
          case 'elliptical':
            // 타원형 헤드 - 더 정확한 형태
            geometry = new THREE.SphereGeometry(scaledRadius, 64, 32);
            geometry.scale(1, 0.4, 1); // 더 납작한 타원
            break;
          case 'hemispherical':
            // 반구형 헤드 - 완전한 반구
            geometry = new THREE.SphereGeometry(scaledRadius, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2);
            break;
          default: // flat
            // 평면 헤드 - 더 얇게
            geometry = new THREE.CylinderGeometry(
              scaledRadius, 
              scaledRadius, 
              scaleFactor * 0.05, 
              64
            );
        }
        
        const head = new THREE.Mesh(geometry, headMaterial);
        head.castShadow = true;
        head.receiveShadow = true;
        
        // 위치 조정 - 바디와 완전히 연결되도록
        if (isTop) {
          if (type === 'flat') {
            head.position.y = scaledHeight / 2 + scaleFactor * 0.025;
          } else if (type === 'elliptical') {
            head.position.y = scaledHeight / 2 + scaledRadius * 0.2;
          } else { // hemispherical
            head.position.y = scaledHeight / 2;
            head.rotation.x = 0;
          }
        } else {
          if (type === 'flat') {
            head.position.y = -scaledHeight / 2 - scaleFactor * 0.025;
          } else if (type === 'elliptical') {
            head.position.y = -scaledHeight / 2 - scaledRadius * 0.2;
          } else { // hemispherical
            head.position.y = -scaledHeight / 2;
            head.rotation.x = Math.PI;
          }
        }
        
        return head;
      };

      // 헤드 추가
      const topHead = createHead(topHeadType, true);
      const bottomHead = createHead(bottomHeadType, false);
      tankGroup.add(topHead);
      tankGroup.add(bottomHead);

      // 용접선 추가 (헤드가 flat이 아닌 경우에만)
      if (topHeadType !== 'flat') {
        const topWeld = createWeldLine(scaledHeight / 2);
        tankGroup.add(topWeld);
      }
      if (bottomHeadType !== 'flat') {
        const bottomWeld = createWeldLine(-scaledHeight / 2);
        tankGroup.add(bottomWeld);
      }

      // 치수선 생성 함수
      const createDimensionLine = (
        start: THREE.Vector3, 
        end: THREE.Vector3, 
        text: string
      ) => {
        const lineGroup = new THREE.Group();
        
        // 치수선
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([start, end]);
        const lineMaterial = new THREE.LineBasicMaterial({ 
          color: 0x374151, 
          linewidth: 2 
        });
        const line = new THREE.Line(lineGeometry, lineMaterial);
        lineGroup.add(line);
        
        // 화살표 (작은 원뿔)
        const arrowGeometry = new THREE.ConeGeometry(0.05 * scaleFactor, 0.1 * scaleFactor, 8);
        const arrowMaterial = new THREE.MeshBasicMaterial({ color: 0x374151 });
        
        const arrow1 = new THREE.Mesh(arrowGeometry, arrowMaterial);
        const arrow2 = new THREE.Mesh(arrowGeometry, arrowMaterial);
        
        arrow1.position.copy(start);
        arrow2.position.copy(end);
        
        // 화살표 방향 설정
        const direction = new THREE.Vector3().subVectors(end, start).normalize();
        arrow1.lookAt(start.clone().add(direction));
        arrow2.lookAt(end.clone().sub(direction));
        
        lineGroup.add(arrow1);
        lineGroup.add(arrow2);
        
        // 텍스트 라벨
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        canvas.width = 512;
        canvas.height = 128;
        
        // 배경
        context.fillStyle = 'rgba(255, 255, 255, 0.95)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // 테두리
        context.strokeStyle = '#374151';
        context.lineWidth = 2;
        context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
        
        // 텍스트
        context.fillStyle = '#374151';
        context.font = 'bold 48px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, canvas.width / 2, canvas.height / 2);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        
        // 라벨 위치
        const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        sprite.position.copy(midPoint);
        sprite.scale.set(2.4 * scaleFactor, 0.6 * scaleFactor, 1);
        
        lineGroup.add(sprite);
        return lineGroup;
      };

      // 치수선 추가
      const totalHeight = scaledHeight + 
        (topHeadType === 'flat' ? scaleFactor * 0.1 : scaledRadius * 0.4) +
        (bottomHeadType === 'flat' ? scaleFactor * 0.1 : scaledRadius * 0.4);
      
      // 높이 치수선
      const heightLine = createDimensionLine(
        new THREE.Vector3(scaledRadius + scaleFactor * 0.8, -totalHeight / 2, 0),
        new THREE.Vector3(scaledRadius + scaleFactor * 0.8, totalHeight / 2, 0),
        `H: ${height.toFixed(1)}m`
      );
      
      // 직경 치수선
      const diameterLine = createDimensionLine(
        new THREE.Vector3(-scaledRadius, totalHeight / 2 + scaleFactor * 0.8, 0),
        new THREE.Vector3(scaledRadius, totalHeight / 2 + scaleFactor * 0.8, 0),
        `Ø: ${diameter.toFixed(1)}m`
      );
      
      dimensionGroup.add(heightLine);
      dimensionGroup.add(diameterLine);

      // 바닥 그리드 (선택적)
      const gridHelper = new THREE.GridHelper(
        scaledRadius * 3, 
        20, 
        0xd1d5db, 
        0xe5e7eb
      );
      gridHelper.position.y = -totalHeight / 2 - scaleFactor * 0.2;
      scene.add(gridHelper);

      scene.add(tankGroup);
      scene.add(dimensionGroup);

      // 카메라 위치 조정
      const distance = Math.max(scaledRadius * 3, totalHeight * 1.5);
      camera.position.set(distance * 1.2, distance * 0.8, distance * 1.2);
      camera.lookAt(0, 0, 0);

      // 컨트롤 업데이트
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.minDistance = distance * 0.5;
        controlsRef.current.maxDistance = distance * 3;
        controlsRef.current.update();
      }
    };

    // 컨트롤 설정
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = true;
    controls.enablePan = true;
    controls.autoRotate = false;
    controlsRef.current = controls;

    // 초기 탱크 생성
    updateTank();

    // 애니메이션 루프
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 리사이즈 핸들러
    const handleResize = () => {
      if (!mountRef.current || !renderer || !camera) return;
      
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    
    window.addEventListener('resize', handleResize);

    // 클린업
    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      window.removeEventListener('resize', handleResize);
      if (controlsRef.current) {
        controlsRef.current.dispose();
      }
      if (currentMount && renderer.domElement && currentMount.contains(renderer.domElement)) {
        currentMount.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [diameter, height, topHeadType, bottomHeadType]);

  return (
    <div 
      ref={mountRef} 
      className="w-full h-full bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg overflow-hidden"
      style={{ minHeight: '400px' }}
    />
  );
}