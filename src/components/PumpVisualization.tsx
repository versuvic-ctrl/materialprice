'use client';

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';

interface PumpVisualizationProps {
  flowRate?: number;
  head?: number;
  power?: number;
  speed?: number;
  efficiency?: number;
  npshRequired?: number;
  npshAvailable?: number;
}

const PumpVisualization: React.FC<PumpVisualizationProps> = ({
  flowRate = 100,
  head = 50,
  power = 15,
  speed = 1750,
  efficiency = 75,
  npshRequired = 3,
  npshAvailable = 5
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const [isRotating, setIsRotating] = useState(true);
  const impellerRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // Scene 설정
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);
    sceneRef.current = scene;

    // Camera 설정
    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(8, 6, 8);
    camera.lookAt(0, 0, 0);

    // Renderer 설정
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);

    // 조명 설정
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    const pointLight = new THREE.PointLight(0x4f46e5, 0.5, 50);
    pointLight.position.set(-5, 5, 5);
    scene.add(pointLight);

    // 재질 정의
    const pumpBodyMaterial = new THREE.MeshPhongMaterial({
      color: 0x2563eb,
      shininess: 100,
      specular: 0x111111
    });

    const impellerMaterial = new THREE.MeshPhongMaterial({
      color: 0x1d4ed8,
      shininess: 150,
      specular: 0x222222
    });

    const pipeMaterial = new THREE.MeshPhongMaterial({
      color: 0x6b7280,
      shininess: 80
    });

    const motorMaterial = new THREE.MeshPhongMaterial({
      color: 0x374151,
      shininess: 60
    });

    // 펌프 케이싱 생성
    const casingGroup = new THREE.Group();
    
    // 메인 케이싱 (볼류트)
    const casingGeometry = new THREE.SphereGeometry(2, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.8);
    const casing = new THREE.Mesh(casingGeometry, pumpBodyMaterial);
    casing.castShadow = true;
    casing.receiveShadow = true;
    casingGroup.add(casing);

    // 흡입구
    const suctionGeometry = new THREE.CylinderGeometry(0.8, 0.8, 3, 16);
    const suction = new THREE.Mesh(suctionGeometry, pipeMaterial);
    suction.position.set(-3.5, 0, 0);
    suction.rotation.z = Math.PI / 2;
    suction.castShadow = true;
    casingGroup.add(suction);

    // 토출구
    const dischargeGeometry = new THREE.CylinderGeometry(0.6, 0.6, 2.5, 16);
    const discharge = new THREE.Mesh(dischargeGeometry, pipeMaterial);
    discharge.position.set(0, 3, 0);
    discharge.castShadow = true;
    casingGroup.add(discharge);

    scene.add(casingGroup);

    // 임펠러 생성
    const impellerGroup = new THREE.Group();
    impellerRef.current = impellerGroup;

    // 임펠러 허브
    const hubGeometry = new THREE.CylinderGeometry(0.3, 0.5, 0.8, 16);
    const hub = new THREE.Mesh(hubGeometry, impellerMaterial);
    hub.castShadow = true;
    impellerGroup.add(hub);

    // 임펠러 블레이드
    const bladeCount = 6;
    for (let i = 0; i < bladeCount; i++) {
      const angle = (i / bladeCount) * Math.PI * 2;
      
      // 블레이드 형상 (곡선형)
      const bladeShape = new THREE.Shape();
      bladeShape.moveTo(0.5, 0);
      bladeShape.quadraticCurveTo(1.2, 0.3, 1.5, 0);
      bladeShape.lineTo(1.3, -0.1);
      bladeShape.quadraticCurveTo(1.0, 0.2, 0.5, -0.1);
      bladeShape.lineTo(0.5, 0);

      const bladeGeometry = new THREE.ExtrudeGeometry(bladeShape, {
        depth: 0.1,
        bevelEnabled: true,
        bevelThickness: 0.02,
        bevelSize: 0.02
      });

      const blade = new THREE.Mesh(bladeGeometry, impellerMaterial);
      blade.position.set(0, 0, 0);
      blade.rotation.y = angle;
      blade.rotation.x = Math.PI / 2;
      blade.castShadow = true;
      impellerGroup.add(blade);
    }

    scene.add(impellerGroup);

    // 모터 생성
    const motorGroup = new THREE.Group();
    
    // 모터 본체
    const motorBodyGeometry = new THREE.CylinderGeometry(1, 1, 3, 16);
    const motorBody = new THREE.Mesh(motorBodyGeometry, motorMaterial);
    motorBody.position.set(4, 0, 0);
    motorBody.rotation.z = Math.PI / 2;
    motorBody.castShadow = true;
    motorGroup.add(motorBody);

    // 모터 팬
    const fanGeometry = new THREE.CylinderGeometry(0.8, 0.8, 0.2, 16);
    const fan = new THREE.Mesh(fanGeometry, motorMaterial);
    fan.position.set(5.5, 0, 0);
    fan.rotation.z = Math.PI / 2;
    motorGroup.add(fan);

    // 샤프트
    const shaftGeometry = new THREE.CylinderGeometry(0.1, 0.1, 6, 8);
    const shaft = new THREE.Mesh(shaftGeometry, new THREE.MeshPhongMaterial({ color: 0x8b5cf6 }));
    shaft.position.set(1, 0, 0);
    shaft.rotation.z = Math.PI / 2;
    shaft.castShadow = true;
    motorGroup.add(shaft);

    scene.add(motorGroup);

    // 베이스 플레이트
    const baseGeometry = new THREE.BoxGeometry(8, 0.3, 4);
    const baseMaterial = new THREE.MeshPhongMaterial({ color: 0x6b7280 });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.set(1, -2.5, 0);
    base.receiveShadow = true;
    scene.add(base);

    // 유체 흐름 시각화 (파티클)
    const particleCount = 50;
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 10;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 6;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 6;
      
      velocities[i * 3] = (Math.random() - 0.5) * 0.1;
      velocities[i * 3 + 1] = Math.random() * 0.05;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.1;
    }

    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const particleMaterial = new THREE.PointsMaterial({
      color: 0x3b82f6,
      size: 0.1,
      transparent: true,
      opacity: 0.6
    });
    
    const particleSystem = new THREE.Points(particles, particleMaterial);
    scene.add(particleSystem);

    // 성능 표시 텍스트 (3D 텍스트 대신 HTML 오버레이로 처리)
    const performanceDiv = document.createElement('div');
    performanceDiv.style.position = 'absolute';
    performanceDiv.style.top = '10px';
    performanceDiv.style.left = '10px';
    performanceDiv.style.color = '#1f2937';
    performanceDiv.style.fontSize = '12px';
    performanceDiv.style.fontFamily = 'monospace';
    performanceDiv.style.background = 'rgba(255,255,255,0.9)';
    performanceDiv.style.padding = '8px';
    performanceDiv.style.borderRadius = '4px';
    performanceDiv.style.pointerEvents = 'none';
    performanceDiv.innerHTML = `
      <div><strong>펌프 성능</strong></div>
      <div>유량: ${flowRate} m³/h</div>
      <div>양정: ${head} m</div>
      <div>동력: ${power} kW</div>
      <div>회전수: ${speed} rpm</div>
      <div>효율: ${efficiency}%</div>
      <div style="margin-top: 8px;"><strong>NPSH</strong></div>
      <div>필요: ${npshRequired} m</div>
      <div>유효: ${npshAvailable} m</div>
      <div style="color: ${npshAvailable > npshRequired ? '#059669' : '#dc2626'}">
        ${npshAvailable > npshRequired ? '✓ 안전' : '⚠ 위험'}
      </div>
    `;
    mountRef.current.appendChild(performanceDiv);

    // 애니메이션
    const animate = () => {
      if (isRotating && impellerRef.current) {
        impellerRef.current.rotation.y += 0.1;
      }

      // 파티클 애니메이션
      const positions = particleSystem.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        positions[i * 3] += velocities[i * 3];
        positions[i * 3 + 1] += velocities[i * 3 + 1];
        positions[i * 3 + 2] += velocities[i * 3 + 2];

        // 경계 체크 및 리셋
        if (positions[i * 3] > 5) positions[i * 3] = -5;
        if (positions[i * 3 + 1] > 3) positions[i * 3 + 1] = -3;
        if (positions[i * 3 + 2] > 3) positions[i * 3 + 2] = -3;
      }
      particleSystem.geometry.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
      animationIdRef.current = requestAnimationFrame(animate);
    };

    animate();

    // 마우스 컨트롤
    let mouseX = 0;
    let mouseY = 0;
    let targetRotationX = 0;
    let targetRotationY = 0;

    const onMouseMove = (event: MouseEvent) => {
      mouseX = (event.clientX / window.innerWidth) * 2 - 1;
      mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
      targetRotationX = mouseY * 0.2;
      targetRotationY = mouseX * 0.2;
    };

    const updateCameraPosition = () => {
      camera.position.x += (8 + targetRotationY * 3 - camera.position.x) * 0.05;
      camera.position.y += (6 + targetRotationX * 3 - camera.position.y) * 0.05;
      camera.lookAt(0, 0, 0);
      requestAnimationFrame(updateCameraPosition);
    };

    window.addEventListener('mousemove', onMouseMove);
    updateCameraPosition();

    // 리사이즈 핸들러
    const handleResize = () => {
      if (!mountRef.current) return;
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', handleResize);
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      if (performanceDiv.parentNode) {
        performanceDiv.parentNode.removeChild(performanceDiv);
      }
      renderer.dispose();
    };
  }, [flowRate, head, power, speed, efficiency, npshRequired, npshAvailable, isRotating]);

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="w-full h-full" />
      <div className="absolute bottom-4 right-4">
        <button
          onClick={() => setIsRotating(!isRotating)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors"
        >
          {isRotating ? '정지' : '회전'}
        </button>
      </div>
    </div>
  );
};

export default PumpVisualization;