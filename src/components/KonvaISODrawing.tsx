'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ASMEMaterialSelector from './ASMEMaterialSelector';
import type { ASMEMaterial } from '@/data/asmeMaterials';
import { 
  MousePointer, Square, Circle as CircleIcon, Minus, Type, Trash2, Download,
  Move, Palette, Settings, ZoomIn, ZoomOut, RotateCcw, Save,
  Cylinder, Zap, Thermometer, Building, Wind, Minus as PipeIcon, CircleIcon as ValveIcon
} from 'lucide-react';

interface DrawingElement {
  id: string;
  type: 'line' | 'rectangle' | 'circle' | 'text' | 'tank' | 'pump' | 'heat_exchanger' | 
        'column' | 'compressor' | 'pipe' | 'valve' | 'freehand' | 'cloud';
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  points?: number[];
  text?: string;
  fontSize?: number;
  stroke: string;
  strokeWidth: number;
  fill?: string;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  material?: string;
  draggable?: boolean;
}

interface KonvaISODrawingProps {
  className?: string;
}



const KonvaISODrawing: React.FC<KonvaISODrawingProps> = ({
  className = ''
}) => {
  const [isClient, setIsClient] = useState(false);
  const [konvaLoaded, setKonvaLoaded] = useState(false);
  const [Stage, setStage] = useState<any>(null);
  const [Layer, setLayer] = useState<any>(null);
  const [Line, setLine] = useState<any>(null);
  const [Rect, setRect] = useState<any>(null);
  const [Circle, setCircle] = useState<any>(null);
  const [Text, setText] = useState<any>(null);
  const [Group, setGroup] = useState<any>(null);
  const [Transformer, setTransformer] = useState<any>(null);
  
  const stageRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);
  const [elements, setElements] = useState<DrawingElement[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentElement, setCurrentElement] = useState<DrawingElement | null>(null);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<string>('select');
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [currentStroke, setCurrentStroke] = useState('#000000');
  const [currentStrokeWidth, setCurrentStrokeWidth] = useState(2);
  const [currentFill, setCurrentFill] = useState('transparent');

  const [isTextEditing, setIsTextEditing] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [freehandPoints, setFreehandPoints] = useState<number[]>([]);
  const [cloudPoints, setCloudPoints] = useState<number[]>([]);
  const [selectedASMEMaterial, setSelectedASMEMaterial] = useState<ASMEMaterial | undefined>();

  useEffect(() => {
    setIsClient(true);
    
    // 동적으로 react-konva 컴포넌트들을 로드
    const loadKonva = async () => {
      try {
        const reactKonva = await import('react-konva');
        setStage(() => reactKonva.Stage);
        setLayer(() => reactKonva.Layer);
        setLine(() => reactKonva.Line);
        setRect(() => reactKonva.Rect);
        setCircle(() => reactKonva.Circle);
        setText(() => reactKonva.Text);
        setGroup(() => reactKonva.Group);
        setTransformer(() => reactKonva.Transformer);
        setKonvaLoaded(true);
      } catch (error) {
        console.error('Konva 로드 실패:', error);
      }
    };
    
    loadKonva();
  }, []);

  // 줌 기능
  const handleWheel = useCallback((e: any) => {
    e.evt.preventDefault();
    
    const scaleBy = 1.1;
    const stage = e.target.getStage();
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };
    
    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    
    setZoomLevel(newScale);
    
    stage.scale({ x: newScale, y: newScale });
    
    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    stage.position(newPos);
  }, []);

  const snapToGridValue = useCallback((value: number) => {
    if (!snapToGrid) return value;
    const gridSize = 20;
    return Math.round(value / gridSize) * gridSize;
  }, [snapToGrid]);

  // ISO 각도로 스냅하는 함수 (0도, 30도, 60도, 90도, 120도, 150도)
  const snapToISOAngle = useCallback((startX: number, startY: number, endX: number, endY: number) => {
    if (!snapToGrid) return { x: endX, y: endY };
    
    const dx = endX - startX;
    const dy = endY - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 10) return { x: endX, y: endY }; // 너무 짧으면 스냅하지 않음
    
    const angle = Math.atan2(dy, dx);
    const isoAngles = [0, Math.PI/6, Math.PI/3, Math.PI/2, 2*Math.PI/3, 5*Math.PI/6, Math.PI, -Math.PI/6, -Math.PI/3, -Math.PI/2, -2*Math.PI/3, -5*Math.PI/6];
    
    // 가장 가까운 ISO 각도 찾기
    let closestAngle = isoAngles[0];
    let minDiff = Math.abs(angle - isoAngles[0]);
    
    for (const isoAngle of isoAngles) {
      const diff = Math.abs(angle - isoAngle);
      if (diff < minDiff) {
        minDiff = diff;
        closestAngle = isoAngle;
      }
    }
    
    // 새로운 끝점 계산
    const newEndX = startX + distance * Math.cos(closestAngle);
    const newEndY = startY + distance * Math.sin(closestAngle);
    
    return {
      x: snapToGridValue(newEndX),
      y: snapToGridValue(newEndY)
    };
  }, [snapToGrid, snapToGridValue]);

  const handleMouseDown = useCallback((e: any) => {
    // 클릭한 대상이 빈 공간인지 확인
    const clickedOnEmpty = e.target === e.target.getStage();
    
    if (clickedOnEmpty) {
      setSelectedElement(null);
    }
    
    if (selectedTool === 'select') return;
    
    const pos = e.target.getStage().getPointerPosition();
    const x = snapToGridValue(pos.x);
    const y = snapToGridValue(pos.y);
    
    setIsDrawing(true);
    
    const newElement: DrawingElement = {
      id: Date.now().toString(),
      type: selectedTool as any,
      x,
      y,
      stroke: currentStroke,
      strokeWidth: currentStrokeWidth,
      fill: currentFill,
      material: selectedASMEMaterial?.code || '',
      draggable: true
    };
    
    if (selectedTool === 'line') {
      newElement.points = [x, y, x, y];
    } else if (selectedTool === 'rectangle') {
      newElement.width = 0;
      newElement.height = 0;
    } else if (selectedTool === 'circle') {
      newElement.radius = 0;
    } else if (selectedTool === 'text') {
      newElement.text = textInput || 'Text';
      newElement.fontSize = 16;
      newElement.fill = currentStroke;
    } else if (selectedTool === 'freehand') {
      newElement.points = [x, y];
      setFreehandPoints([x, y]);
    } else if (selectedTool === 'cloud') {
      newElement.points = [x, y];
      setCloudPoints([x, y]);
    } else if (['tank', 'pump', 'heat_exchanger', 'column', 'compressor', 'pipe', 'valve'].includes(selectedTool)) {
      // 산업용 컴포넌트들의 기본 크기 설정
      newElement.width = 60;
      newElement.height = 60;
    }
    
    setCurrentElement(newElement);
  }, [selectedTool, snapToGridValue, currentStroke, currentStrokeWidth, currentFill, selectedASMEMaterial, textInput]);

  const handleMouseMove = useCallback((e: any) => {
    if (!isDrawing || !currentElement) return;
    
    const pos = e.target.getStage().getPointerPosition();
    let x = snapToGridValue(pos.x);
    let y = snapToGridValue(pos.y);
    
    const updatedElement = { ...currentElement };
    
    if (currentElement.type === 'line' && currentElement.points) {
      // ISO 각도로 스냅
      const snappedPos = snapToISOAngle(currentElement.points[0], currentElement.points[1], x, y);
      updatedElement.points = [currentElement.points[0], currentElement.points[1], snappedPos.x, snappedPos.y];
    } else if (currentElement.type === 'rectangle') {
      updatedElement.width = Math.abs(x - currentElement.x);
      updatedElement.height = Math.abs(y - currentElement.y);
    } else if (currentElement.type === 'circle') {
      const radius = Math.sqrt(Math.pow(x - currentElement.x, 2) + Math.pow(y - currentElement.y, 2));
      updatedElement.radius = radius;
    } else if (currentElement.type === 'freehand') {
      const newPoints = [...freehandPoints, x, y];
      setFreehandPoints(newPoints);
      updatedElement.points = newPoints;
    } else if (currentElement.type === 'cloud') {
      const newPoints = [...cloudPoints, x, y];
      setCloudPoints(newPoints);
      updatedElement.points = newPoints;
    }
    
    setCurrentElement(updatedElement);
  }, [isDrawing, currentElement, snapToGridValue, freehandPoints, cloudPoints]);

  const handleMouseUp = useCallback(() => {
    if (!isDrawing || !currentElement) return;
    
    setElements(prev => [...prev, currentElement]);
    setCurrentElement(null);
    setIsDrawing(false);
    setFreehandPoints([]);
    setCloudPoints([]);
  }, [isDrawing, currentElement]);

  const handleElementClick = useCallback((elementId: string) => {
    setSelectedElement(elementId);
    if (selectedTool === 'select') {
      // 선택된 요소에 트랜스포머 적용
      const element = elements.find(el => el.id === elementId);
      if (element && transformerRef.current) {
        const node = stageRef.current.findOne(`#${elementId}`);
        if (node) {
          transformerRef.current.nodes([node]);
        }
      }
    }
  }, [selectedTool, elements]);

  const deleteElement = useCallback((elementId: string) => {
    setElements(prev => prev.filter(el => el.id !== elementId));
    if (selectedElement === elementId) {
      setSelectedElement(null);
      if (transformerRef.current) {
        transformerRef.current.nodes([]);
      }
    }
  }, [selectedElement]);

  const clearAll = useCallback(() => {
    setElements([]);
    setSelectedElement(null);
    if (transformerRef.current) {
      transformerRef.current.nodes([]);
    }
  }, []);

  const saveAsImage = useCallback(() => {
    if (!stageRef.current) return;
    
    const dataURL = stageRef.current.toDataURL();
    const link = document.createElement('a');
    link.download = 'iso-drawing.png';
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const zoomIn = useCallback(() => {
    const newZoom = Math.min(zoomLevel * 1.2, 5);
    setZoomLevel(newZoom);
    if (stageRef.current) {
      stageRef.current.scale({ x: newZoom, y: newZoom });
    }
  }, [zoomLevel]);

  const zoomOut = useCallback(() => {
    const newZoom = Math.max(zoomLevel / 1.2, 0.1);
    setZoomLevel(newZoom);
    if (stageRef.current) {
      stageRef.current.scale({ x: newZoom, y: newZoom });
    }
  }, [zoomLevel]);

  const resetZoom = useCallback(() => {
    setZoomLevel(1);
    if (stageRef.current) {
      stageRef.current.scale({ x: 1, y: 1 });
      stageRef.current.position({ x: 0, y: 0 });
    }
  }, []);

  const handleTextEdit = useCallback((elementId: string) => {
    const element = elements.find(el => el.id === elementId);
    if (element && element.type === 'text') {
      setTextInput(element.text || '');
      setIsTextEditing(true);
    }
  }, [elements]);

  const updateTextElement = useCallback(() => {
    if (selectedElement && textInput) {
      setElements(prev => prev.map(el => 
        el.id === selectedElement 
          ? { ...el, text: textInput }
          : el
      ));
      setIsTextEditing(false);
      setTextInput('');
    }
  }, [selectedElement, textInput]);

  const renderGrid = useCallback(() => {
    if (!showGrid || !Line) return null;
    
    const gridLines = [];
    const gridSize = 20;
    const width = 1200;
    const height = 800;
    
    // ISO 그리드 - 30도 각도의 아이소메트릭 그리드
    const isoAngle = Math.PI / 6; // 30도
    const isoSpacing = gridSize;
    
    // 수직선 (Y축)
    for (let i = 0; i <= width / isoSpacing; i++) {
      gridLines.push(
        <Line
          key={`v${i}`}
          points={[i * isoSpacing, 0, i * isoSpacing, height]}
          stroke="#e0e0e0"
          strokeWidth={0.5}
          listening={false}
        />
      );
    }
    
    // 30도 대각선 (우상향)
    const diagonalSpacing = isoSpacing / Math.cos(isoAngle);
    for (let i = -height / isoSpacing; i <= width / isoSpacing + height / isoSpacing; i++) {
      const startX = i * isoSpacing;
      const startY = 0;
      const endX = startX + height * Math.tan(isoAngle);
      const endY = height;
      
      if (startX <= width + height * Math.tan(isoAngle) && endX >= 0) {
        gridLines.push(
          <Line
            key={`d1_${i}`}
            points={[startX, startY, endX, endY]}
            stroke="#e0e0e0"
            strokeWidth={0.5}
            listening={false}
          />
        );
      }
    }
    
    // -30도 대각선 (우하향)
    for (let i = 0; i <= width / isoSpacing + height / isoSpacing; i++) {
      const startX = i * isoSpacing;
      const startY = 0;
      const endX = startX - height * Math.tan(isoAngle);
      const endY = height;
      
      if (startX >= -height * Math.tan(isoAngle) && endX <= width) {
        gridLines.push(
          <Line
            key={`d2_${i}`}
            points={[startX, startY, endX, endY]}
            stroke="#e0e0e0"
            strokeWidth={0.5}
            listening={false}
          />
        );
      }
    }
    
    return gridLines;
  }, [showGrid, Line]);

  // 산업용 컴포넌트 렌더링
  const renderIndustrialComponent = useCallback((element: DrawingElement) => {
    if (!Group || !Rect || !Circle || !Line) return null;

    const { id, type, x, y, width = 60, height = 60, stroke, strokeWidth, fill } = element;

    switch (type) {
      case 'tank':
        return (
          <Group key={id} id={id} x={x} y={y} draggable={element.draggable}>
            <Rect
              width={width}
              height={height}
              stroke={stroke}
              strokeWidth={strokeWidth}
              fill={fill}
              cornerRadius={5}
            />
            <Line
              points={[10, height - 10, width - 10, height - 10]}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
          </Group>
        );
      
      case 'pump':
        return (
          <Group key={id} id={id} x={x} y={y} draggable={element.draggable}>
            <Circle
              x={width / 2}
              y={height / 2}
              radius={Math.min(width, height) / 2 - 5}
              stroke={stroke}
              strokeWidth={strokeWidth}
              fill={fill}
            />
            <Line
              points={[width / 2 - 10, height / 2, width / 2 + 10, height / 2]}
              stroke={stroke}
              strokeWidth={strokeWidth + 1}
            />
          </Group>
        );
      
      case 'heat_exchanger':
        return (
          <Group key={id} id={id} x={x} y={y} draggable={element.draggable}>
            <Rect
              width={width}
              height={height}
              stroke={stroke}
              strokeWidth={strokeWidth}
              fill={fill}
            />
            <Line
              points={[10, 10, width - 10, height - 10]}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
            <Line
              points={[width - 10, 10, 10, height - 10]}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
          </Group>
        );
      
      case 'column':
        return (
          <Group key={id} id={id} x={x} y={y} draggable={element.draggable}>
            <Rect
              width={width}
              height={height}
              stroke={stroke}
              strokeWidth={strokeWidth}
              fill={fill}
            />
            {[1, 2, 3, 4].map(i => (
              <Line
                key={i}
                points={[5, (height / 5) * i, width - 5, (height / 5) * i]}
                stroke={stroke}
                strokeWidth={strokeWidth / 2}
              />
            ))}
          </Group>
        );
      
      case 'compressor':
        return (
          <Group key={id} id={id} x={x} y={y} draggable={element.draggable}>
            <Rect
              width={width}
              height={height}
              stroke={stroke}
              strokeWidth={strokeWidth}
              fill={fill}
            />
            <Line
              points={[width / 4, height / 4, 3 * width / 4, 3 * height / 4]}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
            <Line
              points={[3 * width / 4, height / 4, width / 4, 3 * height / 4]}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
          </Group>
        );
      
      case 'valve':
        return (
          <Group key={id} id={id} x={x} y={y} draggable={element.draggable}>
            <Line
              points={[width / 2, 0, 0, height / 2, width / 2, height, width, height / 2, width / 2, 0]}
              stroke={stroke}
              strokeWidth={strokeWidth}
              fill={fill}
              closed={true}
            />
          </Group>
        );
      
      default:
        return null;
    }
  }, [Group, Rect, Circle, Line]);

  if (!isClient || !konvaLoaded || !Stage || !Layer) {
    return (
      <div className="w-full h-full bg-white border rounded-lg overflow-hidden flex items-center justify-center">
        <div>로딩 중...</div>
      </div>
    );
  }

  return (
    <div className={`w-full h-full bg-white border rounded-lg overflow-hidden ${className}`}>
      {/* 상단 툴바 */}
      <div className="flex items-center gap-2 p-3 border-b bg-gray-50 flex-wrap">
        {/* 기본 도구 */}
        <div className="flex items-center gap-1 border-r pr-2">
          <Button
            variant={selectedTool === 'select' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTool('select')}
            title="선택 도구"
          >
            <MousePointer className="w-4 h-4" />
          </Button>
          <Button
            variant={selectedTool === 'line' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTool('line')}
            title="직선"
          >
            <Minus className="w-4 h-4" />
          </Button>
          <Button
            variant={selectedTool === 'rectangle' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTool('rectangle')}
            title="사각형"
          >
            <Square className="w-4 h-4" />
          </Button>
          <Button
            variant={selectedTool === 'circle' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTool('circle')}
            title="원"
          >
            <CircleIcon className="w-4 h-4" />
          </Button>
          <Button
            variant={selectedTool === 'text' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTool('text')}
            title="텍스트"
          >
            <Type className="w-4 h-4" />
          </Button>
          <Button
            variant={selectedTool === 'freehand' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTool('freehand')}
            title="자유곡선"
          >
            <Move className="w-4 h-4" />
          </Button>
          <Button
            variant={selectedTool === 'cloud' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTool('cloud')}
            title="클라우드 마크"
          >
            <CircleIcon className="w-4 h-4" />
          </Button>
        </div>

        {/* 산업용 컴포넌트 */}
        <div className="flex items-center gap-1 border-r pr-2">
          <Button
            variant={selectedTool === 'tank' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTool('tank')}
            title="탱크"
          >
            <Cylinder className="w-4 h-4" />
          </Button>
          <Button
            variant={selectedTool === 'pump' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTool('pump')}
            title="펌프"
          >
            <Zap className="w-4 h-4" />
          </Button>
          <Button
            variant={selectedTool === 'heat_exchanger' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTool('heat_exchanger')}
            title="열교환기"
          >
            <Thermometer className="w-4 h-4" />
          </Button>
          <Button
            variant={selectedTool === 'column' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTool('column')}
            title="칼럼"
          >
            <Building className="w-4 h-4" />
          </Button>
          <Button
            variant={selectedTool === 'compressor' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTool('compressor')}
            title="압축기"
          >
            <Wind className="w-4 h-4" />
          </Button>
          <Button
            variant={selectedTool === 'pipe' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTool('pipe')}
            title="배관"
          >
            <PipeIcon className="w-4 h-4" />
          </Button>
          <Button
            variant={selectedTool === 'valve' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTool('valve')}
            title="밸브"
          >
            <ValveIcon className="w-4 h-4" />
          </Button>
        </div>

        {/* 줌 컨트롤 */}
        <div className="flex items-center gap-1 border-r pr-2">
          <Button
            variant="outline"
            size="sm"
            onClick={zoomOut}
            title="축소"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-sm px-2">{Math.round(zoomLevel * 100)}%</span>
          <Button
            variant="outline"
            size="sm"
            onClick={zoomIn}
            title="확대"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={resetZoom}
            title="원래 크기"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>

        {/* 설정 */}
        <div className="flex items-center gap-2">
          <Button
            variant={showGrid ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowGrid(!showGrid)}
            title="그리드 표시"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1" />

        {/* 액션 버튼 */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={clearAll}
            title="모두 지우기"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={saveAsImage}
            title="이미지로 저장"
          >
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 속성 패널 */}
      <div className="flex items-center gap-4 p-2 border-b bg-gray-25 text-sm">
        <div className="flex items-center gap-2">
          <label>선 색상:</label>
          <input
            type="color"
            value={currentStroke}
            onChange={(e) => setCurrentStroke(e.target.value)}
            className="w-8 h-6 border rounded"
          />
        </div>
        <div className="flex items-center gap-2">
          <label>선 두께:</label>
          <input
            type="range"
            min="1"
            max="10"
            value={currentStrokeWidth}
            onChange={(e) => setCurrentStrokeWidth(Number(e.target.value))}
            className="w-20"
          />
          <span>{currentStrokeWidth}px</span>
        </div>
        <div className="flex items-center gap-2">
          <label>채우기:</label>
          <input
            type="color"
            value={currentFill === 'transparent' ? '#ffffff' : currentFill}
            onChange={(e) => setCurrentFill(e.target.value)}
            className="w-8 h-6 border rounded"
          />
          <Button
            variant={currentFill === 'transparent' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCurrentFill('transparent')}
          >
            투명
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <label>ASME 자재:</label>
          <ASMEMaterialSelector
            selectedMaterial={selectedASMEMaterial}
            onMaterialSelect={setSelectedASMEMaterial}
            className="w-64"
          />
        </div>
        {isTextEditing && (
          <div className="flex items-center gap-2">
            <Input
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="텍스트 입력"
              className="w-32"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  updateTextElement();
                }
              }}
            />
            <Button size="sm" onClick={updateTextElement}>
              적용
            </Button>
          </div>
        )}
      </div>

      {/* 캔버스 영역 */}
      <div className="relative w-full" style={{ height: 'calc(100% - 120px)' }}>
        <Stage
          ref={stageRef}
          width={1200}
          height={800}
          scaleX={zoomLevel}
          scaleY={zoomLevel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
        >
          <Layer>
            {/* 그리드 */}
            {showGrid && renderGrid()}
            
            {/* 요소들 렌더링 */}
            {elements.map((element) => {
              if (element.type === 'line' && Line) {
                return (
                  <Line
                    key={element.id}
                    points={element.points}
                    stroke={element.stroke}
                    strokeWidth={element.strokeWidth}
                    onClick={() => handleElementClick(element.id)}
                    draggable={element.draggable}
                  />
                );
              } else if (element.type === 'rectangle' && Rect) {
                return (
                  <Rect
                    key={element.id}
                    x={element.x}
                    y={element.y}
                    width={element.width}
                    height={element.height}
                    stroke={element.stroke}
                    strokeWidth={element.strokeWidth}
                    fill={element.fill}
                    onClick={() => handleElementClick(element.id)}
                    draggable={element.draggable}
                    rotation={element.rotation}
                    scaleX={element.scaleX}
                    scaleY={element.scaleY}
                  />
                );
              } else if (element.type === 'circle' && Circle) {
                return (
                  <Circle
                    key={element.id}
                    x={element.x}
                    y={element.y}
                    radius={element.radius}
                    stroke={element.stroke}
                    strokeWidth={element.strokeWidth}
                    fill={element.fill}
                    onClick={() => handleElementClick(element.id)}
                    draggable={element.draggable}
                    rotation={element.rotation}
                    scaleX={element.scaleX}
                    scaleY={element.scaleY}
                  />
                );
              } else if (element.type === 'text' && Text) {
                return (
                  <Text
                    key={element.id}
                    x={element.x}
                    y={element.y}
                    text={element.text}
                    fontSize={element.fontSize}
                    fill={element.stroke}
                    onClick={() => handleElementClick(element.id)}
                    onDblClick={() => handleTextEdit(element.id)}
                    draggable={element.draggable}
                    rotation={element.rotation}
                    scaleX={element.scaleX}
                    scaleY={element.scaleY}
                  />
                );
              } else if (element.type === 'freehand' && Line) {
                return (
                  <Line
                    key={element.id}
                    points={element.points}
                    stroke={element.stroke}
                    strokeWidth={element.strokeWidth}
                    tension={0.5}
                    lineCap="round"
                    lineJoin="round"
                    onClick={() => handleElementClick(element.id)}
                    draggable={element.draggable}
                  />
                );
              } else if (element.type === 'cloud' && Line) {
                return (
                  <Line
                    key={element.id}
                    points={element.points}
                    stroke={element.stroke}
                    strokeWidth={element.strokeWidth}
                    tension={0.8}
                    lineCap="round"
                    lineJoin="round"
                    dash={[10, 5]}
                    onClick={() => handleElementClick(element.id)}
                    draggable={element.draggable}
                  />
                );
              } else if (['tank', 'pump', 'heat_exchanger', 'column', 'compressor', 'pipe', 'valve'].includes(element.type) && Group) {
                return (
                  <Group
                    key={element.id}
                    x={element.x}
                    y={element.y}
                    rotation={element.rotation}
                    scaleX={element.scaleX}
                    scaleY={element.scaleY}
                    onClick={() => handleElementClick(element.id)}
                    draggable={element.draggable}
                  >
                    {renderIndustrialComponent(element)}
                  </Group>
                );
              }
              return null;
            })}
            
            {/* 현재 그리고 있는 요소 */}
            {currentElement && (
              <>
                {currentElement.type === 'line' && Line && (
                  <Line
                    points={currentElement.points}
                    stroke={currentElement.stroke}
                    strokeWidth={currentElement.strokeWidth}
                    dash={[5, 5]}
                  />
                )}
                {currentElement.type === 'rectangle' && Rect && (
                  <Rect
                    x={currentElement.x}
                    y={currentElement.y}
                    width={currentElement.width}
                    height={currentElement.height}
                    stroke={currentElement.stroke}
                    strokeWidth={currentElement.strokeWidth}
                    fill={currentElement.fill}
                    dash={[5, 5]}
                  />
                )}
                {currentElement.type === 'circle' && Circle && (
                  <Circle
                    x={currentElement.x}
                    y={currentElement.y}
                    radius={currentElement.radius}
                    stroke={currentElement.stroke}
                    strokeWidth={currentElement.strokeWidth}
                    fill={currentElement.fill}
                    dash={[5, 5]}
                  />
                )}
                {currentElement.type === 'freehand' && Line && (
                  <Line
                    points={currentElement.points}
                    stroke={currentElement.stroke}
                    strokeWidth={currentElement.strokeWidth}
                    tension={0.5}
                    lineCap="round"
                    lineJoin="round"
                    dash={[5, 5]}
                  />
                )}
                {currentElement.type === 'cloud' && Line && (
                  <Line
                    points={currentElement.points}
                    stroke={currentElement.stroke}
                    strokeWidth={currentElement.strokeWidth}
                    tension={0.8}
                    lineCap="round"
                    lineJoin="round"
                    dash={[10, 5]}
                  />
                )}
              </>
            )}
            
            {/* 트랜스포머 */}
            {Transformer && selectedElement && (
              <Transformer
                ref={transformerRef}
                boundBoxFunc={(oldBox: any, newBox: any) => {
                  // 최소 크기 제한
                  if (newBox.width < 5 || newBox.height < 5) {
                    return oldBox;
                  }
                  return newBox;
                }}
              />
            )}
          </Layer>
        </Stage>
      </div>
    </div>
  );
};

export default KonvaISODrawing;