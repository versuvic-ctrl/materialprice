'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import Strike from '@tiptap/extension-strike';
import Code from '@tiptap/extension-code';
import CodeBlock from '@tiptap/extension-code-block';
import Blockquote from '@tiptap/extension-blockquote';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import ListItem from '@tiptap/extension-list-item';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import FontFamily from '@tiptap/extension-font-family';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import Dropcursor from '@tiptap/extension-dropcursor';
import Gapcursor from '@tiptap/extension-gapcursor';
import HardBreak from '@tiptap/extension-hard-break';
import HorizontalRule from '@tiptap/extension-horizontal-rule';

import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code as CodeIcon,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Image as ImageIcon,
  Table as TableIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Palette,
  Highlighter,
  Type,
  Undo,
  Redo,
  Save,
  Minus,
  MoreHorizontal,
  Eye,
  Settings
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import CategoryManager from './CategoryManager';

interface Category {
  id: string;
  name: string;
}

interface TiptapEditorProps {
  content?: string;
  onChange?: (content: string) => void;
  onSave?: (content: string) => void;
  placeholder?: string;
  editable?: boolean;
  showToolbar?: boolean;
  className?: string;
  title?: string;
  onTitleChange?: (title: string) => void;
  categories?: Array<{ id: string; name: string }>;
  selectedCategory?: string;
  onCategoryChange?: (categoryId: string) => void;
  onUpdateCategories?: (categories: Category[]) => Promise<void>;
}

const TiptapEditor: React.FC<TiptapEditorProps> = ({
  content = '',
  onChange,
  onSave,
  placeholder = '내용을 입력하세요...',
  editable = true,
  showToolbar = true,
  className = '',
  title = '',
  onTitleChange,
  categories = [],
  selectedCategory = '',
  onCategoryChange,
  onUpdateCategories,
}) => {
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isLinkPopoverOpen, setIsLinkPopoverOpen] = useState(false);
  const [isImagePopoverOpen, setIsImagePopoverOpen] = useState(false);
  const [isColorPopoverOpen, setIsColorPopoverOpen] = useState(false);
  const [isHighlightPopoverOpen, setIsHighlightPopoverOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // StarterKit에 포함된 확장들을 비활성화하여 중복 방지
        link: false,
        dropcursor: false,
        gapcursor: false,
        hardBreak: false,
        horizontalRule: false,
        bulletList: {
          HTMLAttributes: {
            class: 'list-disc list-inside ml-4',
          },
        },
        orderedList: {
          HTMLAttributes: {
            class: 'list-decimal list-inside ml-4',
          },
        },
        codeBlock: {
          HTMLAttributes: {
            class: 'bg-gray-100 dark:bg-gray-800 rounded-lg p-4 font-mono text-sm border',
          },
        },
        blockquote: {
          HTMLAttributes: {
            class: 'border-l-4 border-blue-500 pl-4 italic bg-blue-50 dark:bg-blue-900/20 py-2 my-4',
          },
        },
        // code, strike, underline는 StarterKit에서 제공하는 것을 사용
      }),
      Placeholder.configure({
        placeholder: '내용을 입력하세요... "/" 를 입력하면 명령어를 사용할 수 있습니다.',
        emptyEditorClass: 'is-editor-empty',
      }),
      Typography,
      Dropcursor.configure({
        color: '#3b82f6',
        width: 2,
      }),
      Gapcursor,
      HardBreak,
      HorizontalRule.configure({
        HTMLAttributes: {
          class: 'my-6 border-gray-300 dark:border-gray-600',
        },
      }),
      TextStyle,
      Color.configure({
        types: ['textStyle'],
      }),
      Highlight.configure({
        multicolor: true,
        HTMLAttributes: {
          class: 'rounded px-1',
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right', 'justify'],
      }),
      Underline,
      Strike,
      Code.configure({
        HTMLAttributes: {
          class: 'bg-gray-100 dark:bg-gray-800 rounded px-1 py-0.5 font-mono text-sm',
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 dark:text-blue-400 underline cursor-pointer hover:text-blue-800 dark:hover:text-blue-300',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg shadow-sm',
        },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'border-collapse table-auto w-full border border-gray-300 dark:border-gray-600',
        },
      }),
      TableRow.configure({
        HTMLAttributes: {
          class: 'border-b border-gray-300 dark:border-gray-600',
        },
      }),
      TableHeader.configure({
        HTMLAttributes: {
          class: 'border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-4 py-2 text-left font-semibold',
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-gray-300 dark:border-gray-600 px-4 py-2',
        },
      }),
      FontFamily.configure({
        types: ['textStyle'],
      }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange?.(html);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none min-h-[600px] focus:outline-none px-6 py-4 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100',
        spellcheck: 'false',
      },
      handleDOMEvents: {
        keydown: (view, event) => {
          // Handle keyboard shortcuts
          if (event.key === 'Tab') {
            event.preventDefault();
            return true;
          }
          return false;
        },
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  const handleSave = useCallback(() => {
    if (editor) {
      const html = editor.getHTML();
      onSave?.(html);
    }
  }, [editor, onSave]);

  const setLink = useCallback(() => {
    if (!editor) return;

    if (linkUrl) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
    } else {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    }
    setLinkUrl('');
    setIsLinkPopoverOpen(false);
  }, [editor, linkUrl]);

  const addImage = useCallback(() => {
    if (!editor || !imageUrl) return;

    editor.chain().focus().setImage({ src: imageUrl }).run();
    setImageUrl('');
    setIsImagePopoverOpen(false);
  }, [editor, imageUrl]);

  const insertTable = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertTable({ 
      rows: 3, 
      cols: 3, 
      withHeaderRow: true 
    }).run();
  }, [editor]);

  const insertHorizontalRule = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().setHorizontalRule().run();
  }, [editor]);

  const toggleCodeBlock = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().toggleCodeBlock().run();
  }, [editor]);

  const colors = [
    '#000000', '#374151', '#6B7280', '#9CA3AF', '#D1D5DB',
    '#EF4444', '#F97316', '#EAB308', '#22C55E', '#3B82F6',
    '#8B5CF6', '#EC4899', '#F43F5E', '#06B6D4', '#84CC16'
  ];

  const highlights = [
    '#FEF3C7', '#DBEAFE', '#D1FAE5', '#FCE7F3', '#E0E7FF',
    '#FED7D7', '#FFF2CC', '#D4EDDA', '#F8D7DA', '#D1ECF1'
  ];

  const fontFamilies = [
    { label: '기본', value: 'inherit' },
    { label: 'Arial', value: 'Arial, sans-serif' },
    { label: 'Helvetica', value: 'Helvetica, sans-serif' },
    { label: 'Times New Roman', value: 'Times New Roman, serif' },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Courier New', value: 'Courier New, monospace' },
    { label: '나눔고딕', value: 'Nanum Gothic, sans-serif' },
    { label: '맑은 고딕', value: 'Malgun Gothic, sans-serif' },
  ];

  if (!editor) {
    return null;
  }

  return (
    <div className={`w-full max-w-none ${className}`}>
      {/* 제목 입력 영역 */}
      <div className="mb-4">
        <Input
          type="text"
          placeholder="제목을 입력하세요..."
          value={title}
          onChange={(e) => onTitleChange?.(e.target.value)}
          className="w-full text-3xl font-bold border border-gray-200 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white placeholder:text-gray-400 shadow-sm"
        />
      </div>

      {/* 에디터 영역 */}
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
        {showToolbar && (
          <div className="border-b border-gray-200 bg-gray-50/50 px-4 py-2">
            <div className="flex flex-wrap items-center gap-1">
              {/* 기본 그룹 */}
              <div className="flex items-center bg-white rounded-lg border border-gray-200 p-1 shadow-sm">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor.chain().focus().undo().run()}
                  disabled={!editor.can().undo()}
                  className="h-8 w-8 p-0 hover:bg-gray-100 rounded-md transition-colors"
                  title="실행 취소"
                >
                  <Undo className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor.chain().focus().redo().run()}
                  disabled={!editor.can().redo()}
                  className="h-8 w-8 p-0 hover:bg-gray-100 rounded-md transition-colors"
                  title="다시 실행"
                >
                  <Redo className="h-4 w-4" />
                </Button>
              </div>

              {/* 제목 그룹 */}
              <div className="flex items-center bg-white rounded-lg border border-gray-200 p-1 shadow-sm">
                <Button
                  variant={editor.isActive('heading', { level: 1 }) ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                  className="h-8 w-8 p-0 hover:bg-gray-100 rounded-md transition-colors"
                  title="제목 1"
                >
                  <Heading1 className="h-4 w-4" />
                </Button>
                <Button
                  variant={editor.isActive('heading', { level: 2 }) ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                  className="h-8 w-8 p-0 hover:bg-gray-100 rounded-md transition-colors"
                  title="제목 2"
                >
                  <Heading2 className="h-4 w-4" />
                </Button>
                <Button
                  variant={editor.isActive('heading', { level: 3 }) ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                  className="h-8 w-8 p-0 hover:bg-gray-100 rounded-md transition-colors"
                  title="제목 3"
                >
                  <Heading3 className="h-4 w-4" />
                </Button>
              </div>

              {/* 텍스트 스타일 그룹 */}
              <div className="flex items-center bg-white rounded-lg border border-gray-200 p-1 shadow-sm">
                <Button
                  variant={editor.isActive('bold') ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  className="h-8 w-8 p-0 hover:bg-gray-100 rounded-md transition-colors"
                  title="굵게"
                >
                  <Bold className="h-4 w-4" />
                </Button>
                <Button
                  variant={editor.isActive('italic') ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  className="h-8 w-8 p-0 hover:bg-gray-100 rounded-md transition-colors"
                  title="기울임"
                >
                  <Italic className="h-4 w-4" />
                </Button>
                <Button
                  variant={editor.isActive('underline') ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleUnderline().run()}
                  className="h-8 w-8 p-0 hover:bg-gray-100 rounded-md transition-colors"
                  title="밑줄"
                >
                  <UnderlineIcon className="h-4 w-4" />
                </Button>
                <Button
                  variant={editor.isActive('strike') ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleStrike().run()}
                  className="h-8 w-8 p-0 hover:bg-gray-100 rounded-md transition-colors"
                  title="취소선"
                >
                  <Strikethrough className="h-4 w-4" />
                </Button>
                <Button
                  variant={editor.isActive('code') ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleCode().run()}
                  className="h-8 w-8 p-0 hover:bg-gray-100 rounded-md transition-colors"
                  title="인라인 코드"
                >
                  <CodeIcon className="h-4 w-4" />
                </Button>
              </div>

              {/* 색상 그룹 */}
              <div className="flex items-center bg-white rounded-lg border border-gray-200 p-1 shadow-sm">
                <Popover open={isColorPopoverOpen} onOpenChange={setIsColorPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-gray-100 rounded-md transition-colors"
                      title="텍스트 색상"
                    >
                      <Type className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3">
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium">텍스트 색상</h4>
                      <div className="grid grid-cols-5 gap-2">
                        {colors.map((color) => (
                          <button
                            key={color}
                            className="w-8 h-8 rounded border border-gray-200 hover:scale-110 transition-transform"
                            style={{ backgroundColor: color }}
                            onClick={() => {
                              editor.chain().focus().setColor(color).run();
                              setIsColorPopoverOpen(false);
                            }}
                          />
                        ))}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          editor.chain().focus().unsetColor().run();
                          setIsColorPopoverOpen(false);
                        }}
                        className="w-full"
                      >
                        기본 색상으로 재설정
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>

                <Popover open={isHighlightPopoverOpen} onOpenChange={setIsHighlightPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-gray-100 rounded-md transition-colors"
                      title="하이라이트"
                    >
                      <Highlighter className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3">
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium">하이라이트</h4>
                      <div className="grid grid-cols-5 gap-2">
                        {highlights.map((color) => (
                          <button
                            key={color}
                            className="w-8 h-8 rounded border border-gray-200 hover:scale-110 transition-transform"
                            style={{ backgroundColor: color }}
                            onClick={() => {
                              editor.chain().focus().setHighlight({ color }).run();
                              setIsHighlightPopoverOpen(false);
                            }}
                          />
                        ))}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          editor.chain().focus().unsetHighlight().run();
                          setIsHighlightPopoverOpen(false);
                        }}
                        className="w-full"
                      >
                        하이라이트 제거
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* 정렬 그룹 */}
              <div className="flex items-center bg-white rounded-lg border border-gray-200 p-1 shadow-sm">
                <Button
                  variant={editor.isActive({ textAlign: 'left' }) ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().setTextAlign('left').run()}
                  className="h-8 w-8 p-0 hover:bg-gray-100 rounded-md transition-colors"
                  title="왼쪽 정렬"
                >
                  <AlignLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant={editor.isActive({ textAlign: 'center' }) ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().setTextAlign('center').run()}
                  className="h-8 w-8 p-0 hover:bg-gray-100 rounded-md transition-colors"
                  title="가운데 정렬"
                >
                  <AlignCenter className="h-4 w-4" />
                </Button>
                <Button
                  variant={editor.isActive({ textAlign: 'right' }) ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().setTextAlign('right').run()}
                  className="h-8 w-8 p-0 hover:bg-gray-100 rounded-md transition-colors"
                  title="오른쪽 정렬"
                >
                  <AlignRight className="h-4 w-4" />
                </Button>
              </div>

              {/* 리스트 그룹 */}
              <div className="flex items-center bg-white rounded-lg border border-gray-200 p-1 shadow-sm">
                <Button
                  variant={editor.isActive('bulletList') ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                  className="h-8 w-8 p-0 hover:bg-gray-100 rounded-md transition-colors"
                  title="불릿 리스트"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={editor.isActive('orderedList') ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleOrderedList().run()}
                  className="h-8 w-8 p-0 hover:bg-gray-100 rounded-md transition-colors"
                  title="번호 리스트"
                >
                  <ListOrdered className="h-4 w-4" />
                </Button>
              </div>

              {/* 블록 요소 그룹 */}
              <div className="flex items-center bg-white rounded-lg border border-gray-200 p-1 shadow-sm">
                <Button
                  variant={editor.isActive('blockquote') ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleBlockquote().run()}
                  className="h-8 w-8 p-0 hover:bg-gray-100 rounded-md transition-colors"
                  title="인용문"
                >
                  <Quote className="h-4 w-4" />
                </Button>
                <Button
                  variant={editor.isActive('codeBlock') ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={toggleCodeBlock}
                  className="h-8 w-8 p-0 hover:bg-gray-100 rounded-md transition-colors"
                  title="코드 블록"
                >
                  <Code2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={insertHorizontalRule}
                  className="h-8 w-8 p-0 hover:bg-gray-100 rounded-md transition-colors"
                  title="구분선"
                >
                  <Minus className="h-4 w-4" />
                </Button>
              </div>

              {/* 미디어 그룹 */}
              <div className="flex items-center bg-white rounded-lg border border-gray-200 p-1 shadow-sm">
                <Popover open={isLinkPopoverOpen} onOpenChange={setIsLinkPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant={editor.isActive('link') ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-gray-100 rounded-md transition-colors"
                      title="링크"
                    >
                      <LinkIcon className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-3">
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium">링크 추가</h4>
                      <Input
                        placeholder="URL을 입력하세요"
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            setLink();
                          }
                        }}
                      />
                      <div className="flex gap-2">
                        <Button onClick={setLink} size="sm" className="flex-1">
                          링크 설정
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            editor.chain().focus().unsetLink().run();
                            setIsLinkPopoverOpen(false);
                          }}
                          size="sm"
                        >
                          제거
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                <Popover open={isImagePopoverOpen} onOpenChange={setIsImagePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-gray-100 rounded-md transition-colors"
                      title="이미지"
                    >
                      <ImageIcon className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-3">
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium">이미지 추가</h4>
                      <Input
                        placeholder="이미지 URL을 입력하세요"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            addImage();
                          }
                        }}
                      />
                      <Button onClick={addImage} size="sm" className="w-full">
                        이미지 추가
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={insertTable}
                  className="h-8 w-8 p-0 hover:bg-gray-100 rounded-md transition-colors"
                  title="테이블"
                >
                  <TableIcon className="h-4 w-4" />
                </Button>
              </div>

              {/* 기타 그룹 */}
              <div className="flex items-center bg-white rounded-lg border border-gray-200 p-1 shadow-sm ml-auto">
                <Button
                  variant={isPreviewMode ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setIsPreviewMode(!isPreviewMode)}
                  className="h-8 px-3 hover:bg-gray-100 rounded-md transition-colors"
                  title="미리보기"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  미리보기
                </Button>
                {onSave && (
                  <Button
                    onClick={handleSave}
                    size="sm"
                    className="h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors ml-1"
                    title="저장"
                  >
                    <Save className="h-4 w-4 mr-1" />
                    저장
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 에디터 콘텐츠 */}
        <div className="p-6">
          {isPreviewMode ? (
            <div 
              className="prose prose-lg max-w-none min-h-[500px] focus:outline-none"
              dangerouslySetInnerHTML={{ __html: editor.getHTML() }}
            />
          ) : (
            <EditorContent 
              editor={editor} 
              className="prose prose-lg max-w-none min-h-[500px] focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[500px] [&_.ProseMirror]:p-0"
            />
          )}
        </div>
      </div>

      {/* 카테고리 선택 */}
      {categories && categories.length > 0 && (
        <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Label className="text-sm font-medium text-gray-700">카테고리</Label>
              <Select value={selectedCategory} onValueChange={onCategoryChange}>
                <SelectTrigger className="w-48 h-9 bg-white border-gray-200 rounded-lg">
                  <SelectValue placeholder="카테고리 선택" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {onUpdateCategories && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCategoryManagerOpen(true)}
                className="h-9 px-3 border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Settings className="h-3 w-3 mr-2" />
                카테고리 관리
              </Button>
            )}
          </div>
        </div>
      )}

      {/* 카테고리 관리 모달 */}
      {isCategoryManagerOpen && onUpdateCategories && (
        <CategoryManager
          categories={categories}
          onUpdateCategories={onUpdateCategories}
          onClose={() => setIsCategoryManagerOpen(false)}
        />
      )}
    </div>
  );
};

export default TiptapEditor;