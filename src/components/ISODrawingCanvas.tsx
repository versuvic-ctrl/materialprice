'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { fabric } from 'fabric';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  FileText, 
  RotateCcw, 
  Trash2, 
  Copy, 
  Move3D,
  ZoomIn,
  ZoomOut,
  Grid3X3,
  Save
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface ISODrawingCanvasProps {
  selectedTool: string;
  showGrid: boolean;
  snapToGrid: boolean;
  zoomLevel?: number;
  onToolChange?: (tool: string) => void;
  onElementSelect?: (element: any) => void;
  onElementUpdate?: (element: any) => void;
  onZoomChange?: (zoom: number) => void;
  onMouseMove?: (position: { x: number; y: number }) => void;
}

export interface ISODrawingCanvasRef {
  applyMaterialToSelected: (material: any) => void;
}

interface PipingComponent {
  id: string;
  name: string;
  type: string;
  tagNumber?: string;
  specification?: string;
  properties: {
    diameter?: number;
    pressure?: number;
    temperature?: number;
    material?: string;
  };
}

const ISODrawingCanvas = React.forwardRef<ISODrawingCanvasRef, ISODrawingCanvasProps>(({
  selectedTool,
  showGrid,
  snapToGrid,
  zoomLevel = 100,
  onToolChange,
  onElementSelect,
  onElementUpdate,
  onZoomChange,
  onMouseMove
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const [selectedObject, setSelectedObject] = useState<fabric.Object | null>(null);
  const [components, setComponents] = useState<PipingComponent[]>([]);
  const [zoom, setZoom] = useState(zoomLevel / 100);
  const [gridSize] = useState(20);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingPath, setDrawingPath] = useState<fabric.Path | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // Fabric.js 캔버스 초기화
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: 1200,
      height: 800,
      backgroundColor: '#ffffff',
      selection: true,
      preserveObjectStacking: true,
    });

    fabricCanvasRef.current = canvas;

    // 그리드는 별도 useEffect에서 처리

    // 객체 선택 이벤트
    canvas.on('selection:created', (e) => {
      const obj = e.selected?.[0] || null;
      setSelectedObject(obj);
      onElementSelect?.(obj);
    });

    canvas.on('selection:updated', (e) => {
      const obj = e.selected?.[0] || null;
      setSelectedObject(obj);
      onElementSelect?.(obj);
    });

    canvas.on('selection:cleared', () => {
      setSelectedObject(null);
      onElementSelect?.(null);
    });

    canvas.on('object:modified', (e) => {
      onElementUpdate?.(e.target);
    });

    // 마우스 이벤트 처리
    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);

    return () => {
      canvas.dispose();
    };
  }, []);

  // 그리드 그리기
  const drawGrid = useCallback((canvas: fabric.Canvas) => {
    if (!canvas) return;
    
    // 기존 그리드 제거
    const gridObjects = canvas.getObjects().filter((obj: any) => obj.name === 'grid');
    gridObjects.forEach(obj => canvas.remove(obj));

    if (!showGrid) return;

    const width = canvas.getWidth();
    const height = canvas.getHeight();

    // 수직선
    for (let i = 0; i <= width; i += gridSize) {
      const line = new fabric.Line([i, 0, i, height], {
        stroke: '#e5e7eb',
        strokeWidth: 0.5,
        selectable: false,
        evented: false,
        name: 'grid',
        excludeFromExport: true
      });
      canvas.add(line);
      canvas.sendToBack(line);
    }

    // 수평선
    for (let i = 0; i <= height; i += gridSize) {
      const line = new fabric.Line([0, i, width, i], {
        stroke: '#e5e7eb',
        strokeWidth: 0.5,
        selectable: false,
        evented: false,
        name: 'grid',
        excludeFromExport: true
      });
      canvas.add(line);
      canvas.sendToBack(line);
    }
  }, [showGrid, gridSize]);

  // 그리드 표시 상태 변경 시 그리드 업데이트
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (canvas) {
      drawGrid(canvas);
    }
  }, [showGrid, drawGrid]);

  // 그리드 스냅 함수
  const snapToGridPoint = useCallback((point: { x: number; y: number }) => {
    if (!snapToGrid) return point;
    return {
      x: Math.round(point.x / gridSize) * gridSize,
      y: Math.round(point.y / gridSize) * gridSize,
    };
  }, [snapToGrid, gridSize]);

  // 마우스 이벤트 핸들러
  const handleMouseDown = useCallback((e: fabric.IEvent) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const pointer = canvas.getPointer(e.e);
    const snappedPoint = snapToGridPoint(pointer);

    if (selectedTool === 'select') {
      return; // 기본 선택 동작
    }

    // 그리기 모드
    setIsDrawing(true);
    
    switch (selectedTool) {
      case 'line':
      case 'pipe_straight':
        createPipe(snappedPoint);
        break;
      case 'pipe_elbow':
        createPipeElbow(snappedPoint);
        break;
      case 'pipe_tee':
        createPipeTee(snappedPoint);
        break;
      case 'pipe_reducer':
        createPipeReducer(snappedPoint);
        break;
      case 'rectangle':
        createRectangle(snappedPoint);
        break;
      case 'circle':
        createCircle(snappedPoint);
        break;
      case 'text':
        createText(snappedPoint);
        break;
      case 'tank':
        createTank(snappedPoint);
        break;
      case 'pump':
        createPump(snappedPoint);
        break;
      case 'heat_exchanger':
        createHeatExchanger(snappedPoint);
        break;
      case 'gate_valve':
      case 'ball_valve':
      case 'check_valve':
        createValve(snappedPoint, selectedTool);
        break;
    }
  }, [selectedTool, snapToGridPoint]);

  const handleMouseMove = useCallback((e: fabric.IEvent) => {
    if (!fabricCanvasRef.current) return;
    
    const canvas = fabricCanvasRef.current;
    const pointer = canvas.getPointer(e.e as MouseEvent);
    const position = { x: Math.round(pointer.x), y: Math.round(pointer.y) };
    setMousePosition(position);
    onMouseMove?.(position);

    if (!isDrawing) return;

    const snappedPoint = snapToGridPoint(pointer);

    // 현재 그리고 있는 객체 업데이트
    const activeObject = canvas.getActiveObject();
    if (activeObject && activeObject.name === 'drawing') {
      updateDrawingObject(activeObject, snappedPoint);
      canvas.renderAll();
    }
  }, [isDrawing, snapToGridPoint]);

  const handleMouseUp = useCallback(() => {
    setIsDrawing(false);
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const activeObject = canvas.getActiveObject();
    if (activeObject && activeObject.name === 'drawing') {
      activeObject.name = activeObject.type || 'object';
      finalizeDrawingObject(activeObject);
    }
  }, []);

  // 배관 생성
  const createPipe = useCallback((startPoint: { x: number; y: number }) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const line = new fabric.Line([startPoint.x, startPoint.y, startPoint.x, startPoint.y], {
      stroke: '#1f2937',
      strokeWidth: 4,
      name: 'drawing',
      type: 'pipe',
    });

    canvas.add(line);
    canvas.setActiveObject(line);
  }, []);

  // 파이프 엘보우 생성
  const createPipeElbow = useCallback((point: { x: number; y: number }) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const elbowGroup = new fabric.Group([], {
      left: point.x,
      top: point.y,
      name: 'pipe_elbow',
      type: 'pipe_elbow',
    });

    // 90도 엘보우 (두 개의 직선으로 구성)
    const line1 = new fabric.Line([-20, 0, 0, 0], {
      stroke: '#1f2937',
      strokeWidth: 4,
    });
    
    const line2 = new fabric.Line([0, 0, 0, -20], {
      stroke: '#1f2937',
      strokeWidth: 4,
    });

    // 곡선 연결부
    const curve = new fabric.Path('M 0,0 Q -5,-5 0,-20 Q -5,-5 -20,0', {
      stroke: '#1f2937',
      strokeWidth: 2,
      fill: 'transparent',
    });

    elbowGroup.addWithUpdate(line1);
    elbowGroup.addWithUpdate(line2);
    elbowGroup.addWithUpdate(curve);

    canvas.add(elbowGroup);
  }, []);

  // 파이프 티 생성
  const createPipeTee = useCallback((point: { x: number; y: number }) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const teeGroup = new fabric.Group([], {
      left: point.x,
      top: point.y,
      name: 'pipe_tee',
      type: 'pipe_tee',
    });

    // 메인 라인
    const mainLine = new fabric.Line([-20, 0, 20, 0], {
      stroke: '#1f2937',
      strokeWidth: 4,
    });
    
    // 브랜치 라인
    const branchLine = new fabric.Line([0, 0, 0, -20], {
      stroke: '#1f2937',
      strokeWidth: 4,
    });

    teeGroup.addWithUpdate(mainLine);
    teeGroup.addWithUpdate(branchLine);

    canvas.add(teeGroup);
  }, []);

  // 파이프 리듀서 생성
  const createPipeReducer = useCallback((point: { x: number; y: number }) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const reducerGroup = new fabric.Group([], {
      left: point.x,
      top: point.y,
      name: 'pipe_reducer',
      type: 'pipe_reducer',
    });

    // 리듀서 형태 (사다리꼴)
    const reducer = new fabric.Polygon([
      { x: -20, y: -10 },
      { x: 20, y: -5 },
      { x: 20, y: 5 },
      { x: -20, y: 10 }
    ], {
      stroke: '#1f2937',
      strokeWidth: 2,
      fill: 'transparent',
    });

    reducerGroup.addWithUpdate(reducer);
    canvas.add(reducerGroup);
  }, []);

  // 텍스트 생성
  const createText = useCallback((point: { x: number; y: number }) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const text = new fabric.IText('텍스트를 입력하세요', {
      left: point.x,
      top: point.y,
      fontSize: 14,
      fill: '#1f2937',
      fontFamily: 'Arial, sans-serif',
      editable: true,
    });

    canvas.add(text);
    canvas.setActiveObject(text);
    
    // 텍스트 편집 모드로 진입
    text.enterEditing();
  }, []);

  // 탱크 생성
  const createTank = useCallback((point: { x: number; y: number }) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const tankGroup = new fabric.Group([], {
      left: point.x,
      top: point.y,
      name: 'tank',
      type: 'tank',
    });

    // 탱크 몸체
    const body = new fabric.Rect({
      width: 100,
      height: 150,
      fill: 'transparent',
      stroke: '#1f2937',
      strokeWidth: 2,
      left: -50,
      top: -75,
    });

    // 상부 헤드
    const topHead = new fabric.Ellipse({
      rx: 50,
      ry: 15,
      fill: 'transparent',
      stroke: '#1f2937',
      strokeWidth: 2,
      left: -50,
      top: -90,
    });

    // 하부 헤드
    const bottomHead = new fabric.Ellipse({
      rx: 50,
      ry: 15,
      fill: 'transparent',
      stroke: '#1f2937',
      strokeWidth: 2,
      left: -50,
      top: 60,
    });

    // 태그 번호
    const tagText = new fabric.Text('T-001', {
      fontSize: 12,
      fill: '#1f2937',
      left: -15,
      top: -110,
      fontFamily: 'Arial, sans-serif',
      textAlign: 'center',
    });

    tankGroup.addWithUpdate(body);
    tankGroup.addWithUpdate(topHead);
    tankGroup.addWithUpdate(bottomHead);
    tankGroup.addWithUpdate(tagText);

    canvas.add(tankGroup);
    addComponent({
      id: Date.now().toString(),
      name: 'Tank',
      type: 'tank',
      tagNumber: 'T-001',
      properties: {}
    });
  }, []);

  // 펌프 생성
  const createPump = useCallback((point: { x: number; y: number }) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const pumpGroup = new fabric.Group([], {
      left: point.x,
      top: point.y,
      name: 'pump',
      type: 'pump',
    });

    // 펌프 케이싱
    const casing = new fabric.Circle({
      radius: 25,
      fill: 'transparent',
      stroke: '#1f2937',
      strokeWidth: 2,
      left: -25,
      top: -25,
    });

    // 임펠러
    const impeller = new fabric.Circle({
      radius: 12,
      fill: 'transparent',
      stroke: '#1f2937',
      strokeWidth: 1,
      left: -12,
      top: -12,
    });

    // 흡입구
    const suction = new fabric.Line([-25, 0, -40, 0], {
      stroke: '#1f2937',
      strokeWidth: 3,
    });

    // 토출구
    const discharge = new fabric.Line([0, -25, 0, -40], {
      stroke: '#1f2937',
      strokeWidth: 3,
    });

    // 태그 번호
    const tagText = new fabric.Text('P-001', {
      fontSize: 12,
      fill: '#1f2937',
      left: -15,
      top: 35,
      fontFamily: 'Arial, sans-serif',
      textAlign: 'center',
    });

    pumpGroup.addWithUpdate(casing);
    pumpGroup.addWithUpdate(impeller);
    pumpGroup.addWithUpdate(suction);
    pumpGroup.addWithUpdate(discharge);
    pumpGroup.addWithUpdate(tagText);

    canvas.add(pumpGroup);
    addComponent({
      id: Date.now().toString(),
      name: 'Pump',
      type: 'pump',
      tagNumber: 'P-001',
      properties: {}
    });
  }, []);

  // 열교환기 생성
  const createHeatExchanger = useCallback((point: { x: number; y: number }) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const hexGroup = new fabric.Group([], {
      left: point.x,
      top: point.y,
      name: 'heat_exchanger',
      type: 'heat_exchanger',
    });

    // 외부 쉘
    const shell = new fabric.Rect({
      width: 120,
      height: 60,
      fill: 'transparent',
      stroke: '#1f2937',
      strokeWidth: 2,
      left: -60,
      top: -30,
    });

    // 내부 튜브들
    for (let i = 1; i < 4; i++) {
      const tube = new fabric.Line([-60, -30 + (i * 15), 60, -30 + (i * 15)], {
        stroke: '#1f2937',
        strokeWidth: 1,
      });
      hexGroup.addWithUpdate(tube);
    }

    // 입구 노즐
    const inlet = new fabric.Line([-60, -15, -80, -15], {
      stroke: '#1f2937',
      strokeWidth: 3,
    });

    // 출구 노즐
    const outlet = new fabric.Line([60, 15, 80, 15], {
      stroke: '#1f2937',
      strokeWidth: 3,
    });

    // 태그 번호
    const tagText = new fabric.Text('E-001', {
      fontSize: 12,
      fill: '#1f2937',
      left: -15,
      top: -50,
      fontFamily: 'Arial, sans-serif',
      textAlign: 'center',
    });

    hexGroup.addWithUpdate(shell);
    hexGroup.addWithUpdate(inlet);
    hexGroup.addWithUpdate(outlet);
    hexGroup.addWithUpdate(tagText);

    canvas.add(hexGroup);
    addComponent({
      id: Date.now().toString(),
      name: 'Heat Exchanger',
      type: 'heat_exchanger',
      tagNumber: 'E-001',
      properties: {}
    });
  }, []);

  // 밸브 생성
  const createValve = useCallback((point: { x: number; y: number }, valveType: string) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const valveGroup = new fabric.Group([], {
      left: point.x,
      top: point.y,
      name: valveType,
      type: valveType,
    });

    let symbol;
    let tagPrefix = 'V';

    switch (valveType) {
      case 'gate_valve':
        symbol = new fabric.Rect({
          width: 20,
          height: 20,
          fill: 'transparent',
          stroke: '#1f2937',
          strokeWidth: 2,
          left: -10,
          top: -10,
        });
        tagPrefix = 'GV';
        break;
      case 'ball_valve':
        symbol = new fabric.Circle({
          radius: 10,
          fill: 'transparent',
          stroke: '#1f2937',
          strokeWidth: 2,
          left: -10,
          top: -10,
        });
        tagPrefix = 'BV';
        break;
      case 'check_valve':
        symbol = new fabric.Triangle({
          width: 20,
          height: 20,
          fill: 'transparent',
          stroke: '#1f2937',
          strokeWidth: 2,
          left: -10,
          top: -10,
        });
        tagPrefix = 'CV';
        break;
      default:
        symbol = new fabric.Rect({
          width: 20,
          height: 20,
          fill: 'transparent',
          stroke: '#1f2937',
          strokeWidth: 2,
          left: -10,
          top: -10,
        });
    }

    // 연결 라인
    const line1 = new fabric.Line([-20, 0, -10, 0], {
      stroke: '#1f2937',
      strokeWidth: 2,
    });
    const line2 = new fabric.Line([10, 0, 20, 0], {
      stroke: '#1f2937',
      strokeWidth: 2,
    });

    // 태그 번호
    const tagText = new fabric.Text(`${tagPrefix}-001`, {
      fontSize: 10,
      fill: '#1f2937',
      left: -15,
      top: 15,
      fontFamily: 'Arial, sans-serif',
      textAlign: 'center',
    });

    valveGroup.addWithUpdate(symbol);
    valveGroup.addWithUpdate(line1);
    valveGroup.addWithUpdate(line2);
    valveGroup.addWithUpdate(tagText);

    canvas.add(valveGroup);
    addComponent({
      id: Date.now().toString(),
      name: valveType.replace('_', ' ').toUpperCase(),
      type: valveType,
      tagNumber: `${tagPrefix}-001`,
      properties: {}
    });
  }, []);

  // 기본 도형 생성 함수들
  const createRectangle = useCallback((startPoint: { x: number; y: number }) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const rect = new fabric.Rect({
      left: startPoint.x,
      top: startPoint.y,
      width: 0,
      height: 0,
      fill: 'transparent',
      stroke: '#1f2937',
      strokeWidth: 2,
      name: 'drawing',
      type: 'rectangle',
    });

    canvas.add(rect);
    canvas.setActiveObject(rect);
  }, []);

  const createCircle = useCallback((startPoint: { x: number; y: number }) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const circle = new fabric.Circle({
      left: startPoint.x,
      top: startPoint.y,
      radius: 0,
      fill: 'transparent',
      stroke: '#1f2937',
      strokeWidth: 2,
      name: 'drawing',
      type: 'circle',
    });

    canvas.add(circle);
    canvas.setActiveObject(circle);
  }, []);

  // 그리기 객체 업데이트
  const updateDrawingObject = useCallback((obj: fabric.Object, currentPoint: { x: number; y: number }) => {
    if (obj.type === 'line') {
      const line = obj as fabric.Line;
      line.set({ x2: currentPoint.x, y2: currentPoint.y });
    } else if (obj.type === 'rect') {
      const rect = obj as fabric.Rect;
      const startX = rect.left || 0;
      const startY = rect.top || 0;
      rect.set({
        width: Math.abs(currentPoint.x - startX),
        height: Math.abs(currentPoint.y - startY),
        left: Math.min(startX, currentPoint.x),
        top: Math.min(startY, currentPoint.y),
      });
    } else if (obj.type === 'circle') {
      const circle = obj as fabric.Circle;
      const startX = circle.left || 0;
      const startY = circle.top || 0;
      const radius = Math.sqrt(Math.pow(currentPoint.x - startX, 2) + Math.pow(currentPoint.y - startY, 2)) / 2;
      circle.set({ radius });
    }
  }, []);

  // 그리기 완료 처리
  const finalizeDrawingObject = useCallback((obj: fabric.Object) => {
    // 객체 완료 후 처리 로직
    obj.setCoords();
  }, []);

  // 컴포넌트 추가
  const addComponent = useCallback((component: PipingComponent) => {
    setComponents(prev => [...prev, component]);
  }, []);

  // 줌 제어
  const handleZoom = useCallback((delta: number) => {
    if (!fabricCanvasRef.current) return;
    
    const canvas = fabricCanvasRef.current;
    let newZoom = canvas.getZoom() * (1 + delta);
    newZoom = Math.max(0.1, Math.min(5, newZoom));
    
    canvas.setZoom(newZoom);
    setZoom(newZoom);
    onZoomChange?.(Math.round(newZoom * 100));
    canvas.renderAll();
  }, [onZoomChange]);

  const handleZoomIn = useCallback(() => {
    handleZoom(0.2);
  }, [handleZoom]);

  const handleZoomOut = useCallback(() => {
    handleZoom(-0.2);
  }, [handleZoom]);

  // 줌 레벨 동기화
  useEffect(() => {
    if (fabricCanvasRef.current && Math.abs(zoom - zoomLevel / 100) > 0.01) {
      const newZoom = zoomLevel / 100;
      fabricCanvasRef.current.setZoom(newZoom);
      setZoom(newZoom);
      fabricCanvasRef.current.renderAll();
    }
  }, [zoomLevel, zoom]);

  // 객체 삭제
  const deleteSelected = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !selectedObject) return;

    canvas.remove(selectedObject);
    setSelectedObject(null);
    canvas.renderAll();
  }, [selectedObject]);

  // 객체 복사
  const copySelected = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !selectedObject) return;

    selectedObject.clone((cloned: fabric.Object) => {
      cloned.set({
        left: (cloned.left || 0) + 20,
        top: (cloned.top || 0) + 20,
      });
      canvas.add(cloned);
      canvas.setActiveObject(cloned);
      canvas.renderAll();
    });
  }, [selectedObject]);

  // 캔버스 클리어
  const clearCanvas = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    canvas.clear();
    setComponents([]);
    if (showGrid) {
      drawGrid(canvas);
    }
  }, [showGrid, drawGrid]);

  // 선택된 객체에 자재 적용
  const applyMaterialToSelected = useCallback((material: any) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const activeObjects = canvas.getActiveObjects();
    activeObjects.forEach((obj: any) => {
      // 자재 정보를 객체에 저장
      obj.materialInfo = material;
      
      // 시각적 표시 (색상 변경)
      if (obj.type === 'group') {
        obj.getObjects().forEach((subObj: any) => {
          if (subObj.type === 'line' || subObj.type === 'rect' || subObj.type === 'circle') {
            subObj.set({
              stroke: material.type === 'pipe' ? '#2563eb' : 
                      material.type === 'fitting' ? '#dc2626' :
                      material.type === 'valve' ? '#16a34a' : '#6b7280',
              strokeWidth: 2
            });
          }
        });
      } else {
        obj.set({
          stroke: material.type === 'pipe' ? '#2563eb' : 
                  material.type === 'fitting' ? '#dc2626' :
                  material.type === 'valve' ? '#16a34a' : '#6b7280',
          strokeWidth: 2
        });
      }
      
      // 태그 추가 또는 업데이트
      const tagText = `${material.code}\n${material.nominalSize}`;
      const existingTag = obj.materialTag;
      
      if (existingTag) {
        existingTag.set({ text: tagText });
      } else {
        const tag = new fabric.Text(tagText, {
          left: (obj.left || 0) + (obj.width || 0) + 10,
          top: (obj.top || 0) - 10,
          fontSize: 10,
          fill: '#374151',
          fontFamily: 'Arial, sans-serif',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          padding: 2
        });
        
        canvas.add(tag);
        obj.materialTag = tag;
      }
    });
    
    canvas.renderAll();
    
    // 컴포넌트 상태 업데이트
    setComponents(prev => prev.map(comp => {
      const canvasObj = canvas.getObjects().find((obj: any) => obj.id === comp.id);
      if (canvasObj && (canvasObj as any).materialInfo) {
        return { ...comp, material: (canvasObj as any).materialInfo };
      }
      return comp;
    }));
  }, []);

  // PDF 내보내기
  const exportToPDF = useCallback(async () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const dataURL = canvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 2,
    });

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const imgWidth = 280;
    const imgHeight = 200;

    pdf.addImage(dataURL, 'PNG', 10, 10, imgWidth, imgHeight);
    pdf.save('iso-drawing.pdf');
  }, []);

  // SVG 내보내기 (CAD 호환)
  const exportToSVG = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const svg = canvas.toSVG();
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'iso-drawing.svg';
    link.click();
    
    URL.revokeObjectURL(url);
  }, []);

  // ref를 통해 외부에서 접근할 수 있는 메서드 노출
  React.useImperativeHandle(ref, () => ({
    applyMaterialToSelected
  }), [applyMaterialToSelected]);

  return (
    <div className="flex h-full">
      {/* 메인 캔버스 영역 */}
      <div className="flex-1 relative">
        {/* 상단 툴바 */}
        <div className="absolute top-4 left-4 z-10 flex gap-2">
          <Card className="p-2">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={selectedObject ? "default" : "ghost"}
                onClick={deleteSelected}
                disabled={!selectedObject}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={copySelected}
                disabled={!selectedObject}
              >
                <Copy className="w-4 h-4" />
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <Button size="sm" variant="ghost" onClick={handleZoomIn}>
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={handleZoomOut}>
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-sm px-2 py-1">{Math.round(zoom * 100)}%</span>
            </div>
          </Card>
          
          <Card className="p-2">
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={exportToSVG}>
                <FileText className="w-4 h-4" />
                <span className="ml-1">SVG</span>
              </Button>
              <Button size="sm" variant="ghost" onClick={exportToPDF}>
                <Download className="w-4 h-4" />
                <span className="ml-1">PDF</span>
              </Button>
              <Button size="sm" variant="ghost" onClick={clearCanvas}>
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        </div>

        {/* 캔버스 */}
        <canvas
          ref={canvasRef}
          className="border border-gray-200 bg-white"
          style={{ cursor: selectedTool === 'select' ? 'default' : 'crosshair' }}
        />
      </div>

      {/* 우측 속성 패널 */}
      <div className="w-80 border-l bg-gray-50 p-4 space-y-4">
        {/* 선택된 객체 속성 */}
        {selectedObject && (
          <Card className="p-4">
            <h3 className="font-semibold mb-3">객체 속성</h3>
            <div className="space-y-3">
              <div>
                <Label htmlFor="object-type">타입</Label>
                <Input
                  id="object-type"
                  value={selectedObject.type || 'Unknown'}
                  readOnly
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="object-left">X 좌표</Label>
                <Input
                  id="object-left"
                  type="number"
                  value={Math.round(selectedObject.left || 0)}
                  onChange={(e) => {
                    selectedObject.set({ left: parseInt(e.target.value) });
                    fabricCanvasRef.current?.renderAll();
                  }}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="object-top">Y 좌표</Label>
                <Input
                  id="object-top"
                  type="number"
                  value={Math.round(selectedObject.top || 0)}
                  onChange={(e) => {
                    selectedObject.set({ top: parseInt(e.target.value) });
                    fabricCanvasRef.current?.renderAll();
                  }}
                  className="mt-1"
                />
              </div>
            </div>
          </Card>
        )}

        {/* 컴포넌트 목록 */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3">배관 자재 목록</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {components.map((component) => (
              <div key={component.id} className="flex items-center justify-between p-2 bg-white rounded border">
                <div>
                  <div className="font-medium text-sm">{component.name}</div>
                  <div className="text-xs text-gray-500">{component.tagNumber}</div>
                </div>
                <Badge variant="secondary">{component.type}</Badge>
              </div>
            ))}
            {components.length === 0 && (
              <div className="text-center text-gray-500 py-4">
                배관 자재가 없습니다
              </div>
            )}
          </div>
        </Card>

        {/* 그리드 설정 */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3">캔버스 설정</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>그리드 표시</Label>
              <Button
                size="sm"
                variant={showGrid ? "default" : "outline"}
                onClick={() => {
                  // 부모 컴포넌트의 showGrid 상태를 토글하도록 이벤트 발생
                  // 실제 그리드 토글은 부모에서 처리되어야 함
                  console.log('그리드 토글 요청');
                }}
              >
                <Grid3X3 className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <Label>그리드 크기</Label>
              <span className="text-sm text-gray-600">{gridSize}px</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
});

ISODrawingCanvas.displayName = 'ISODrawingCanvas';

export default ISODrawingCanvas;