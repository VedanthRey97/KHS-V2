
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Upload, 
  Trash2, 
  Settings, 
  Download, 
  Maximize2, 
  Sparkles,
  Loader2,
  CheckCircle2,
  Package,
  Layers,
  LayoutGrid,
  Film,
  X,
  Plus,
  Frame,
  Box,
  Image as ImageIcon,
  Crop as CropIcon,
  Brain,
  History,
  Info,
  Check,
  Tag,
  Palette,
  Eye,
  Type,
  FolderOpen,
  ChevronRight
} from 'lucide-react';
import JSZip from 'jszip';
import Cropper from 'react-easy-crop';
import Papa from 'papaparse';
import { 
  MediaItem, 
  ASPECT_RATIOS, 
  ResizeSettings, 
  ExportFormat,
  FocusSubject,
  MediaType,
  CropMode,
  LearningContext,
  DatabaseRow
} from './types';
import { detectFocalPoint } from './services/aiService';
import { processImage, processVideo } from './services/mediaProcessor';

const App: React.FC = () => {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [learningContext, setLearningContext] = useState<LearningContext>({ 
    recentManualCrops: [],
    recentOffsets: [] 
  });
  const [showComparison, setShowComparison] = useState(false);
  const [processingIndex, setProcessingIndex] = useState(0);
  const [databaseArray, setDatabaseArray] = useState<DatabaseRow[]>([]);
  const [dbLoading, setDbLoading] = useState(true);

  const [productName, setProductName] = useState('');
  const [colorFamily, setColorFamily] = useState('');
  const [imageStyle, setImageStyle] = useState('Product');
  const [category, setCategory] = useState('Standard');
  const [angle, setAngle] = useState('');

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const [settings, setSettings] = useState<ResizeSettings>({
    ratio: ASPECT_RATIOS[0],
    format: 'webp',
    targetFileSizeKb: 800,
    focusSubject: 'smart',
    fit: 'cover'
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchDatabase = async () => {
      const urls = [
        'https://docs.google.com/spreadsheets/d/e/2PACX-1vQSxKT_q9mFRQK1mVD-kDbwUAjjtF8zdpiXRWwLYNdqi75cCzU67zubp_No_aNG_PJjogAW7wCz7FMu/pub?gid=1215034376&single=true&output=csv',
        'https://docs.google.com/spreadsheets/d/e/2PACX-1vQSxKT_q9mFRQK1mVD-kDbwUAjjtF8zdpiXRWwLYNdqi75cCzU67zubp_No_aNG_PJjogAW7wCz7FMu/pub?gid=1074383717&single=true&output=csv',
        'https://docs.google.com/spreadsheets/d/e/2PACX-1vQSxKT_q9mFRQK1mVD-kDbwUAjjtF8zdpiXRWwLYNdqi75cCzU67zubp_No_aNG_PJjogAW7wCz7FMu/pub?gid=66826753&single=true&output=csv',
        'https://docs.google.com/spreadsheets/d/e/2PACX-1vQSxKT_q9mFRQK1mVD-kDbwUAjjtF8zdpiXRWwLYNdqi75cCzU67zubp_No_aNG_PJjogAW7wCz7FMu/pub?gid=0&single=true&output=csv'
      ];

      try {
        setDbLoading(true);
        const fetchPromises = urls.map(async (url) => {
          const response = await fetch(url);
          const csvText = await response.text();
          return new Promise<DatabaseRow[]>((resolve, reject) => {
            Papa.parse(csvText, {
              header: true,
              skipEmptyLines: true,
              transformHeader: (header) => header.trim(),
              complete: (results) => resolve(results.data as DatabaseRow[]),
              error: (err) => reject(err)
            });
          });
        });

        const results = await Promise.all(fetchPromises);
        const combinedData = results.flat();
        setDatabaseArray(combinedData);
        setDbLoading(false);
      } catch (err) {
        console.error("Failed to fetch database:", err);
        setDbLoading(false);
      }
    };
    fetchDatabase();
  }, []);

  const inferView = (filename: string): string => {
    const f = filename.toLowerCase();
    if (f.includes('lifestyle')) return 'Lifestyle';
    if (f.includes('product')) return 'Product';
    if (f.includes('top')) return 'Top';
    if (f.includes('bottom')) return 'Bottom';
    if (f.includes('side')) {
      const match = f.match(/side\s*(\d+)/);
      return match ? `Side ${match[1]}` : 'Side';
    }
    if (f.includes('close') || f.includes('detail')) return 'Close Up';
    return '';
  };

  const slugify = (str: string) => {
    if (!str) return '';
    return str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const getExportFileName = (item: MediaItem, format: string) => {
    const originalName = item.file.name;
    const originalNameBase = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
    
    const clean = (str: string) => {
      if (!str) return '';
      return str.toString().trim().toLowerCase().replace(/[\s,]+/g, '-').replace(/-+/g, '-');
    };

    const pName = clean(item.productName || productName);
    const cFamily = clean(item.colorFamily || colorFamily);
    const cat = clean(item.category || category);
    const style = clean(item.imageStyle || imageStyle);
    const view = clean(item.view || '');
    const ang = clean(item.angle || angle);
    const orig = originalNameBase.replace(/[\s,]+/g, '-'); // Retain original casing, replace spaces and commas with hyphens

    const parts = [pName, cFamily, cat, style, view, ang].filter(Boolean);
    const prefix = parts.join('-');

    return `${prefix}-id-${orig}.${format}`;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, isFolder = false) => {
    const files = e.target.files;
    if (!files) return;

    const newItems: MediaItem[] = Array.from(files).map((file: any) => {
      let itemProductName = productName;
      let itemProductColor = '';
      let itemColorFamily = colorFamily;

      if (isFolder && file.webkitRelativePath) {
        const pathParts = file.webkitRelativePath.split('/');
        if (pathParts.length > 1) {
          const folderName = pathParts[pathParts.length - 2].trim();
          itemProductName = folderName;
          
          const match = databaseArray.find(row => {
            const dbProdName = row['Product Name']?.toString().trim();
            return dbProdName?.toLowerCase() === folderName.toLowerCase();
          });

          if (match) {
            itemProductColor = (match['Color'] || '').toString();
            itemColorFamily = (match['Color Family'] || '').toString();
          }
        }
      }

      return {
        id: Math.random().toString(36).substr(2, 9),
        file: file as File,
        type: file.type.startsWith('video') ? 'video' : 'image',
        url: URL.createObjectURL(file),
        status: 'idle',
        cropMode: 'smart',
        productName: itemProductName,
        productColor: itemProductColor,
        colorFamily: itemColorFamily,
        imageStyle: imageStyle,
        category: category,
        angle: angle,
        view: inferView(file.name)
      };
    });

    setMediaItems(prev => [...prev, ...newItems]);
    if (!selectedId && newItems.length > 0) setSelectedId(newItems[0].id);
    e.target.value = '';
  };

  const processSingleItem = async (id: string) => {
    const item = mediaItems.find(m => m.id === id);
    if (!item) return;

    setMediaItems(prev => prev.map(i => i.id === id ? { ...i, status: 'processing' } : i));

    try {
      let focalPoint = item.focalPoint;
      if (!focalPoint && item.type === 'image' && item.cropMode === 'smart') {
        const compressedBase64 = await new Promise<string>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_DIM = 1024;
            let { width, height } = img;
            if (width > height && width > MAX_DIM) {
              height *= MAX_DIM / width;
              width = MAX_DIM;
            } else if (height > MAX_DIM) {
              width *= MAX_DIM / height;
              height = MAX_DIM;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject('No context');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
          };
          img.onerror = reject;
          img.src = item.url;
        });
        focalPoint = await detectFocalPoint(compressedBase64, settings.focusSubject, learningContext);
      }

      let processedUrl = '';
      const updatedItem = { ...item, focalPoint };
      
      if (item.type === 'image') {
        processedUrl = await processImage(updatedItem, settings);
      } else {
        processedUrl = await processVideo(updatedItem, settings);
      }

      setMediaItems(prev => prev.map(i => i.id === id ? { 
        ...i, 
        processedUrl, 
        focalPoint,
        status: 'done' 
      } : i));
    } catch (err) {
      console.error(err);
      setMediaItems(prev => prev.map(i => i.id === id ? { ...i, status: 'error' } : i));
    }
  };

  const handleProcessAll = async () => {
    setIsProcessingAll(true);
    setProcessingIndex(0);
    const toProcess = mediaItems.filter(i => i.status !== 'done');
    
    for (let i = 0; i < toProcess.length; i++) {
      setProcessingIndex(i + 1);
      await processSingleItem(toProcess[i].id);
    }
    setIsProcessingAll(false);
  };

  const downloadZip = async () => {
    const zip = new JSZip();
    const clean = (str: string) => str ? str.toString().trim().replace(/[\s,]+/g, '-').replace(/-+/g, '-') : '';
    const formattedRatio = settings.ratio.label.replace(':', 'X');
    
    const processedItems = mediaItems.filter(i => i.status === 'done' && i.processedUrl);
    
    for (let i = 0; i < processedItems.length; i++) {
      const item = processedItems[i];
      try {
        const response = await fetch(item.processedUrl!);
        const blob = await response.blob();
        // Cross-reference filename during download
        const fileName = getExportFileName(item, settings.format);
        
        const itemProductName = clean(item.productName) || 'Untitled-Product';
        const folderName = `${itemProductName}-${formattedRatio}`;
        
        zip.folder(folderName)?.file(fileName, blob);
      } catch (e) {
        console.error("Export error for item:", item.id, e);
      }
    }

    const finalZipName = `Knot-Home-Export-${formattedRatio}`;

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${finalZipName}.zip`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const saveManualCrop = () => {
    if (!selectedId || !croppedAreaPixels || !selectedMedia) return;

    const dx = (croppedAreaPixels.x + croppedAreaPixels.width / 2) / (croppedAreaPixels.width * 2) - 0.5;
    const dy = (croppedAreaPixels.y + croppedAreaPixels.height / 2) / (croppedAreaPixels.height * 2) - 0.5;
    
    // Get image dimensions
    const img = new Image();
    img.src = selectedMedia.url;
    
    setLearningContext(prev => ({
      recentOffsets: [{ dx, dy }, ...prev.recentOffsets].slice(0, 5),
      recentManualCrops: [
        {
          aspectRatio: settings.ratio.label,
          crop: croppedAreaPixels,
          imageWidth: img.naturalWidth || 0,
          imageHeight: img.naturalHeight || 0
        },
        ...prev.recentManualCrops
      ].slice(0, 3)
    }));

    setMediaItems(prev => prev.map(item => 
      item.id === selectedId 
        ? { 
            ...item, 
            cropMode: 'manual', 
            manualCrop: croppedAreaPixels, 
            processedUrl: undefined, 
            status: 'idle' 
          } 
        : item
    ));
    setIsCropping(false);
  };

  const updateItemMeta = (id: string, field: 'productName' | 'productColor' | 'colorFamily' | 'imageStyle' | 'category' | 'angle' | 'view', value: string) => {
    setMediaItems(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleReset = () => {
    setMediaItems([]);
    setSelectedId(null);
    setProductName('');
    setColorFamily('');
    setCategory('');
    setImageStyle('Product');
    setAngle('');
    setSettings(s => ({ ...s, ratio: ASPECT_RATIOS[0] }));
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (folderInputRef.current) folderInputRef.current.value = "";
  };

  const doneCount = mediaItems.filter(i => i.status === 'done').length;
  const cropperAspect = settings.ratio.targetPx 
    ? settings.ratio.targetPx.w / settings.ratio.targetPx.h 
    : settings.ratio.width / settings.ratio.height;

  const selectedMedia = mediaItems.find(m => m.id === selectedId);

  return (
    <div className="h-screen flex flex-col selection:bg-sage/20 selection:text-sage overflow-hidden">
      {/* Precision Crop Modal */}
      {isCropping && selectedMedia && (
        <div className="fixed inset-0 z-[100] bg-[#0c0c0c]/98 flex flex-col items-center justify-center p-8 backdrop-blur-3xl animate-reveal">
          <div className="relative w-full max-w-6xl h-[70vh] bg-black rounded-[2rem] overflow-hidden shadow-[0_60px_120px_-20px_rgba(0,0,0,0.8)] border border-white/5">
            <Cropper
              image={selectedMedia.url}
              crop={crop}
              zoom={zoom}
              aspect={cropperAspect}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
            />
          </div>
          <div className="mt-12 flex gap-6">
            <button 
              onClick={() => setIsCropping(false)}
              className="px-12 py-5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold uppercase tracking-[0.25em] text-[10px] transition-all backdrop-blur-md border border-white/10"
            >
              Discard
            </button>
            <button 
              onClick={saveManualCrop}
              className="btn-premium px-16 py-5 bg-sage text-white rounded-xl font-bold uppercase tracking-[0.25em] text-[10px] transition-all shadow-2xl"
            >
              Apply Precision Frame
            </button>
          </div>
        </div>
      )}

      <header className="shrink-0 bg-white/70 backdrop-blur-3xl border-b border-gray-100 py-4 px-16 flex justify-between items-center z-[60]">
        <div className="flex items-center gap-6 cursor-pointer" onClick={handleReset}>
          <div className="w-10 h-10 bg-[#121212] flex items-center justify-center text-white font-serif text-2xl italic rounded-full shadow-2xl">K</div>
          <div>
            <h1 className="font-serif text-2xl tracking-tighter leading-none text-[#121212]">Knot Home <span className="text-gray-300 italic font-light">Studio</span></h1>
            <p className="text-[8px] uppercase tracking-[0.4em] font-bold text-gray-300 mt-1">Professional Content Optimization</p>
          </div>
        </div>

        {/* Top Center Aspect Ratio Controls */}
        <div className="flex justify-center">
          <div className="flex bg-gray-100/50 p-1 rounded-full border border-gray-200 backdrop-blur-sm">
            {ASPECT_RATIOS.map((ratio) => (
              <button
                key={ratio.label}
                onClick={() => {
                  setSettings(s => ({ ...s, ratio }));
                  setMediaItems(prev => prev.map(item => ({
                    ...item, 
                    processedUrl: undefined, 
                    status: 'idle',
                    cropMode: 'smart',
                    manualCrop: undefined
                  })));
                }}
                className={`px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-[0.1em] transition-all ${
                  settings.ratio.label === ratio.label 
                  ? 'bg-[#121212] text-white shadow-lg' 
                  : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {ratio.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            {dbLoading && (
              <div className="absolute -top-1 -right-1 z-10">
                <Loader2 size={10} className="animate-spin text-sage" />
              </div>
            )}
            <button 
              onClick={() => folderInputRef.current?.click()}
              className="group relative flex items-center gap-4 bg-gray-50 hover:bg-gray-100 text-gray-500 px-6 py-2.5 rounded-full border border-gray-100 transition-all"
            >
              <FolderOpen size={14} />
              <span className="text-[9px] font-bold uppercase tracking-[0.2em]">Upload Folder</span>
            </button>
          </div>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="btn-premium group relative flex items-center gap-4 bg-[#121212] text-white px-8 py-2.5 rounded-full shadow-2xl"
          >
            <Plus size={16} className="transition-transform group-hover:rotate-90" />
            <span className="text-[10px] font-bold uppercase tracking-[0.25em]">Add Assets</span>
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={(e) => handleFileUpload(e, false)} 
            className="hidden" 
            multiple 
            accept="image/*,video/*" 
          />
          <input 
            type="file" 
            ref={folderInputRef} 
            onChange={(e) => handleFileUpload(e, true)} 
            className="hidden" 
            multiple
            {...({ webkitdirectory: "", directory: "" } as any)}
          />
        </div>
      </header>

      <main className="flex-1 max-w-[1800px] w-full mx-auto px-12 py-4 grid grid-cols-12 gap-8 overflow-hidden">
        {/* Collection Grid - Left */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-4 overflow-hidden">
          <div className="flex items-center justify-between px-2 shrink-0">
            <div className="flex items-center gap-3">
              <History size={14} className="text-gray-300" />
              <h2 className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.5em]">Studio Collection</h2>
            </div>
            <span className="text-[9px] font-bold text-gray-300 border border-gray-100 px-3 py-0.5 rounded-full">{mediaItems.length}</span>
          </div>
          
          <div className="flex flex-col gap-3 overflow-y-auto pr-2 custom-scrollbar scroll-smooth flex-1">
            {mediaItems.length === 0 ? (
              <div className="border border-dashed border-gray-200 rounded-[2rem] p-10 text-center bg-white/40 flex flex-col items-center gap-4">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-inner border border-gray-50"><Box className="text-gray-100" size={20} /></div>
                <p className="text-gray-200 text-[9px] font-bold uppercase tracking-[0.4em]">Empty Studio</p>
              </div>
            ) : mediaItems.map((item) => (
              <div 
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`group relative cursor-pointer overflow-hidden rounded-[1.25rem] transition-all duration-300 bg-white border shrink-0 ${
                  selectedId === item.id 
                  ? 'border-sage shadow-md ring-1 ring-sage/10' 
                  : 'border-gray-50 opacity-80 hover:opacity-100'
                }`}
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                   {item.type === 'image' ? (
                    <img src={item.url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Queue item" />
                  ) : (
                    <div className="w-full h-full bg-gray-50 flex items-center justify-center">
                      <Film className="text-gray-200" size={20} />
                    </div>
                  )}
                  
                  {item.status === 'processing' && (
                    <div className="absolute inset-0 glass flex items-center justify-center">
                      <Loader2 className="animate-spin text-black" size={18} />
                    </div>
                  )}
                  
                  {item.status === 'done' && (
                    <div className="absolute top-2 right-2 bg-sage text-white p-1 rounded-full shadow-lg">
                      <CheckCircle2 size={10} />
                    </div>
                  )}
                </div>
                
                <div className="p-3 flex justify-between items-center bg-white">
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    <span className="text-[9px] font-bold text-[#121212] uppercase tracking-wider truncate">
                      {item.productName ? `${item.productName}${item.view ? ` (${item.view})` : ''}` : 'Untitled Asset'}
                    </span>
                    <span className="text-[7px] font-medium text-gray-300 truncate">{item.file.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.cropMode === 'smart' ? <Brain size={10} className="text-gray-200" /> : <Frame size={10} className="text-sage" />}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setMediaItems(prev => prev.filter(i => i.id !== item.id));
                        if (selectedId === item.id) setSelectedId(null);
                      }}
                      className="p-1 hover:bg-red-50 text-gray-200 hover:text-red-400 rounded-full transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {mediaItems.length > 0 && (
            <div className="pt-4 border-t border-gray-100 flex flex-col gap-2 shrink-0">
               <button 
                onClick={handleProcessAll}
                disabled={isProcessingAll}
                className="btn-premium w-full py-3.5 bg-[#121212] text-white rounded-xl flex items-center justify-center gap-3 text-[9px] font-bold uppercase tracking-[0.2em] shadow-lg disabled:opacity-50"
              >
                {isProcessingAll ? (
                  <>
                    <Loader2 className="animate-spin" size={14} />
                    Rendering {processingIndex}/{mediaItems.filter(i => i.status !== 'done').length + processingIndex}
                  </>
                ) : (
                  <>
                    <Layers size={14} />
                    Studio Render
                  </>
                )}
              </button>
              {doneCount > 0 && (
                <button 
                  onClick={downloadZip}
                  className="w-full py-3 border border-gray-200 bg-white hover:bg-gray-50 rounded-xl flex items-center justify-center gap-3 transition-all text-[9px] font-bold uppercase tracking-[0.2em] text-gray-400"
                >
                  <Package size={14} />
                  Collect Batch ({doneCount})
                </button>
              )}
              {mediaItems.length > 0 && (
                <button 
                  onClick={handleReset}
                  className="w-full py-3 border border-red-100 bg-red-50/30 hover:bg-red-50 rounded-xl flex items-center justify-center gap-3 transition-all text-[9px] font-bold uppercase tracking-[0.2em] text-red-400"
                >
                  <Trash2 size={14} />
                  Flush Batch
                </button>
              )}
            </div>
          )}
        </div>

        {/* Studio Preview - Center */}
        <div className="col-span-12 lg:col-span-6 flex flex-col h-full overflow-hidden">
          <div className="bg-white border border-gray-100/50 rounded-[2.5rem] p-6 h-full flex flex-col items-center justify-center relative overflow-hidden shadow-premium">
            {!selectedMedia ? (
              <div className="text-center space-y-6 max-w-xs animate-reveal">
                <div className="w-20 h-20 bg-sage/5 rounded-full flex items-center justify-center mx-auto shadow-inner border border-sage/10">
                  <ImageIcon size={28} className="text-sage opacity-40" />
                </div>
                <div>
                  <h3 className="font-serif text-2xl italic tracking-tight mb-2 text-[#121212]">Curate Asset</h3>
                  <p className="text-gray-400 text-[8px] leading-relaxed uppercase tracking-[0.5em] font-semibold">Select an asset from the collection to initialize the Studio Engine.</p>
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4 overflow-hidden animate-reveal">
                <div className="w-full flex justify-between items-center px-2 shrink-0">
                  <div className="flex items-center gap-4">
                    <span className="text-[8px] font-bold uppercase tracking-[0.3em] text-gray-300">Observation Mode</span>
                    {selectedMedia.processedUrl && (
                      <button 
                        onClick={() => setShowComparison(!showComparison)}
                        className={`px-4 py-1 rounded-full text-[7px] font-bold uppercase tracking-widest transition-all ${
                          showComparison ? 'bg-[#121212] text-white shadow-lg' : 'bg-gray-100 text-gray-400 hover:text-black'
                        }`}
                      >
                        {showComparison ? 'Active View' : 'Compare Original'}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-[#fdfdfd] rounded-full border border-gray-100 shadow-sm">
                    <div className={`w-1 h-1 rounded-full ${selectedMedia.status === 'done' ? 'bg-sage' : selectedMedia.status === 'processing' ? 'bg-[#121212] animate-pulse' : 'bg-gray-100'}`}></div>
                    <span className="text-[7px] font-bold uppercase tracking-[0.3em] text-gray-400">{selectedMedia.status}</span>
                  </div>
                </div>

                <div 
                  className="relative w-full max-h-[50vh] bg-[#fcfcfc] rounded-[2rem] shadow-inner border border-gray-100/50 flex items-center justify-center overflow-hidden flex-1"
                  style={{ aspectRatio: cropperAspect }}
                >
                  {selectedMedia.status === 'processing' ? (
                    <div className="flex flex-col items-center gap-6">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full border-2 border-sage/10 border-t-sage animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Sparkles size={18} className="text-sage opacity-40" />
                        </div>
                      </div>
                      <p className="font-serif text-lg italic tracking-widest text-gray-300">Rendering Scene...</p>
                    </div>
                  ) : showComparison ? (
                    <div className="w-full h-full p-6 flex gap-6">
                      <div className="flex-1 flex flex-col gap-3">
                         <span className="text-[7px] font-bold text-center uppercase tracking-[0.4em] text-gray-300">Source Asset</span>
                         <div className="flex-1 bg-white rounded-[1.25rem] overflow-hidden flex items-center justify-center border border-gray-50 shadow-sm">
                            {selectedMedia.type === 'video' ? <video src={selectedMedia.url} className="max-w-full max-h-full" /> : <img src={selectedMedia.url} className="max-w-full max-h-full object-contain" />}
                         </div>
                      </div>
                      <div className="flex-1 flex flex-col gap-3">
                         <span className="text-[7px] font-bold text-center uppercase tracking-[0.4em] text-sage">Studio Optimized</span>
                         <div className="flex-1 bg-white rounded-[1.25rem] overflow-hidden flex items-center justify-center border border-sage/10 shadow-premium">
                            {selectedMedia.type === 'video' ? <video src={selectedMedia.processedUrl} className="max-w-full max-h-full" /> : <img src={selectedMedia.processedUrl} className="max-w-full max-h-full object-contain" />}
                         </div>
                      </div>
                    </div>
                  ) : selectedMedia.processedUrl ? (
                    <div className="w-full h-full p-6 animate-reveal">
                       <div className="w-full h-full flex items-center justify-center overflow-hidden rounded-[1.5rem] bg-white shadow-premium relative group border border-gray-50">
                          {selectedMedia.type === 'video' ? (
                            <video src={selectedMedia.processedUrl} controls className="max-w-full max-h-full" />
                          ) : (
                            <img src={selectedMedia.processedUrl} className="max-w-full max-h-full transition-transform duration-1000 group-hover:scale-[1.02]" alt="Processed preview" />
                          )}
                          <div className="absolute top-6 left-6 bg-black/90 backdrop-blur px-4 py-1.5 rounded-full text-[7px] font-bold text-white uppercase tracking-[0.3em] shadow-xl opacity-0 group-hover:opacity-100 transition-opacity">
                            {getExportFileName(selectedMedia, settings.format)}
                          </div>
                       </div>
                    </div>
                  ) : (
                    <div className="relative w-full h-full flex items-center justify-center group p-6">
                      <div 
                        className="absolute border border-sage z-10 pointer-events-none transition-all duration-700"
                        style={{
                          aspectRatio: `${cropperAspect}`,
                          width: 'min(92%, calc(92% * ' + (cropperAspect > 1 ? '1' : cropperAspect) + '))',
                          maxHeight: '92%',
                          boxShadow: '0 0 0 9999px rgba(252,251,248,0.75)'
                        }}
                      >
                         <div className="absolute top-4 left-4 bg-sage text-white px-3 py-1.5 rounded-full text-[7px] font-bold uppercase tracking-[0.3em] shadow-xl">{settings.ratio.label}</div>
                      </div>
                      <img src={selectedMedia.url} className="max-w-full max-h-full object-contain" alt="Reference" />
                      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-2 group-hover:translate-y-0">
                         <button onClick={() => setIsCropping(true)} className="btn-premium bg-[#121212] text-white px-8 py-3 rounded-full flex items-center gap-3 text-[9px] font-bold uppercase tracking-[0.2em] shadow-xl border border-white/5">
                            <Frame size={16} /> Master Framing
                         </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  {selectedMedia.processedUrl ? (
                     <div className="flex gap-3">
                        <button 
                          onClick={() => setMediaItems(prev => prev.map(i => i.id === selectedMedia.id ? { ...i, status: 'idle', processedUrl: undefined } : i))}
                          className="px-8 py-3 border border-gray-100 bg-white rounded-xl text-[8px] font-bold uppercase tracking-[0.2em] text-gray-400 hover:text-black hover:bg-gray-50 transition-all"
                        >
                          Reset Studio
                        </button>
                        <a 
                          href={selectedMedia.processedUrl} 
                          download={getExportFileName(selectedMedia, settings.format)}
                          className="btn-premium px-10 py-3 bg-[#121212] text-white rounded-xl text-[8px] font-bold uppercase tracking-[0.2em] flex items-center gap-3 shadow-xl"
                        >
                          <Download size={16} />
                          Final Asset Export
                        </a>
                     </div>
                  ) : (
                    <div className="flex gap-3">
                       <button 
                        onClick={() => processSingleItem(selectedMedia.id)}
                        className="btn-premium px-10 py-3 bg-[#121212] text-white rounded-xl text-[9px] font-bold uppercase tracking-[0.2em] flex items-center gap-3 shadow-xl border border-white/5"
                      >
                        <Sparkles size={16} className="text-sage" />
                        Analyze & Optimize
                      </button>
                      {selectedMedia.type === 'image' && (
                        <button 
                          onClick={() => setIsCropping(true)}
                          className="px-8 py-3 border border-gray-200 text-gray-400 hover:text-black rounded-xl text-[9px] font-bold uppercase tracking-[0.2em] flex items-center gap-3 hover:bg-gray-50 transition-all"
                        >
                          <CropIcon size={16} />
                          Precise Crop
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Configuration - Right */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-8 h-full overflow-y-auto custom-scrollbar pr-2 pb-6">
          {/* Asset Identity Section */}
          <div className="flex flex-col gap-6 shrink-0">
            <div className="flex items-center gap-4 px-2">
              <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-50"><Tag size={16} className="text-gray-600" /></div>
              <h2 className="text-[9px] font-bold text-gray-600 uppercase tracking-[0.4em]">Asset Identity</h2>
            </div>
            
            <div className="space-y-4 bg-white/50 backdrop-blur-xl p-5 rounded-[1.5rem] border border-gray-100/50">
              <div className="space-y-2">
                <label className="text-[7px] font-bold text-gray-500 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                  <Type size={10} /> Product Name
                </label>
                <input 
                  type="text" 
                  placeholder="e.g. Anaya Arneson"
                  value={selectedMedia?.productName || productName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setProductName(val);
                    if (selectedMedia) updateItemMeta(selectedMedia.id, 'productName', val);
                  }}
                  className="w-full p-3 rounded-lg border border-gray-100 bg-white text-[9px] font-bold uppercase tracking-widest outline-none focus:border-sage shadow-sm transition-all disabled:opacity-50 text-gray-800"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[7px] font-bold text-gray-500 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                  <Palette size={10} /> Color Family
                </label>
                <input 
                  type="text" 
                  placeholder="e.g. Rust Brown"
                  value={selectedMedia?.colorFamily || colorFamily}
                  onChange={(e) => {
                    const val = e.target.value;
                    setColorFamily(val);
                    if (selectedMedia) updateItemMeta(selectedMedia.id, 'colorFamily', val);
                  }}
                  className="w-full p-3 rounded-lg border border-gray-100 bg-white text-[9px] font-bold uppercase tracking-widest outline-none focus:border-sage shadow-sm transition-all disabled:opacity-50 text-gray-800"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[7px] font-bold text-gray-500 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                  <ImageIcon size={10} /> Image Style
                </label>
                <select
                  value={selectedMedia?.imageStyle || imageStyle}
                  onChange={(e) => {
                    const val = e.target.value;
                    setImageStyle(val);
                    if (selectedMedia) updateItemMeta(selectedMedia.id, 'imageStyle', val);
                  }}
                  className="w-full p-3 rounded-lg border border-gray-100 bg-white text-[9px] font-bold uppercase tracking-widest outline-none focus:border-sage shadow-sm transition-all appearance-none text-gray-800"
                >
                  <option value="Product">Product</option>
                  <option value="Lifestyle">Lifestyle</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[7px] font-bold text-gray-500 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                  <LayoutGrid size={10} /> Category
                </label>
                <select
                  value={selectedMedia?.category || category}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCategory(val);
                    if (selectedMedia) updateItemMeta(selectedMedia.id, 'category', val);
                  }}
                  className="w-full p-3 rounded-lg border border-gray-100 bg-white text-[9px] font-bold uppercase tracking-widest outline-none focus:border-sage shadow-sm transition-all appearance-none text-gray-800"
                >
                  <option value="">Select Category</option>
                  <option value="Bed frame">Bed frame</option>
                  <option value="Bowls">Bowls</option>
                  <option value="Boxes">Boxes</option>
                  <option value="Bundle">Bundle</option>
                  <option value="Candle Holders">Candle Holders</option>
                  <option value="Canisters">Canisters</option>
                  <option value="Jars">Jars</option>
                  <option value="Outdoor">Outdoor</option>
                  <option value="Plates">Plates</option>
                  <option value="Round">Round</option>
                  <option value="Runners">Runners</option>
                  <option value="Single">Single</option>
                  <option value="Sofa">Sofa</option>
                  <option value="Standard">Standard</option>
                  <option value="Statues & Sculptures">Statues & Sculptures</option>
                  <option value="Stools">Stools</option>
                  <option value="Trays">Trays</option>
                  <option value="Vases">Vases</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[7px] font-bold text-gray-500 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                  <Maximize2 size={10} /> Angle
                </label>
                <input 
                  type="text" 
                  placeholder="e.g. front, top, side"
                  value={selectedMedia?.angle || angle}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAngle(val);
                    if (selectedMedia) updateItemMeta(selectedMedia.id, 'angle', val);
                  }}
                  className="w-full p-3 rounded-lg border border-gray-100 bg-white text-[9px] font-bold uppercase tracking-widest outline-none focus:border-sage shadow-sm transition-all disabled:opacity-50 text-gray-800"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[7px] font-bold text-gray-500 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                  <Eye size={10} /> Image View
                </label>
                <select
                  disabled={!selectedMedia}
                  value={selectedMedia?.view || ''}
                  onChange={(e) => selectedMedia && updateItemMeta(selectedMedia.id, 'view', e.target.value)}
                  className="w-full p-3 rounded-lg border border-gray-100 bg-white text-[9px] font-bold uppercase tracking-widest outline-none focus:border-sage shadow-sm transition-all disabled:opacity-50 appearance-none text-gray-800"
                >
                  <option value="">Select View</option>
                  <option value="Front View">Front View</option>
                  <option value="Top View">Top View</option>
                  <option value="Right View">Right View</option>
                  <option value="Left View">Left View</option>
                  <option value="Closeup View">Closeup View</option>
                </select>
              </div>
              
              {selectedMedia && (
                <div className="pt-2 mt-2 border-t border-gray-50 flex flex-col gap-1.5">
                   <span className="text-[6px] font-bold text-gray-500 uppercase tracking-[0.1em] px-2">Filename Preview:</span>
                   <div className="bg-gray-50 p-2 rounded-md font-mono text-[7px] text-gray-600 break-all leading-tight border border-gray-100 italic">
                      {getExportFileName(selectedMedia, settings.format)}
                   </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4 px-2">
              <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-50"><Settings size={16} className="text-gray-600" /></div>
              <h2 className="text-[9px] font-bold text-gray-600 uppercase tracking-[0.4em]">Parameters</h2>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center px-2">
                <label className="text-[8px] font-bold text-gray-500 uppercase tracking-[0.2em]">Target Weight</label>
                <span className="text-[9px] font-bold text-black uppercase tracking-wider">
                  {settings.targetFileSizeKb >= 1024 
                    ? `${(settings.targetFileSizeKb / 1024).toFixed(1)} MB` 
                    : `${settings.targetFileSizeKb} KB`}
                </span>
              </div>
              <div className="px-2">
                <input 
                  type="range" 
                  min="200" 
                  max="4000" 
                  step="100" 
                  value={settings.targetFileSizeKb} 
                  onChange={(e) => setSettings(s => ({ ...s, targetFileSizeKb: parseInt(e.target.value) }))} 
                  className="w-full" 
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[8px] font-bold text-gray-500 uppercase tracking-[0.2em] px-2">Recognition Focus</label>
              <select 
                value={settings.focusSubject}
                onChange={(e) => setSettings(s => ({ ...s, focusSubject: e.target.value as FocusSubject }))}
                className="w-full p-3 rounded-lg border border-gray-100 bg-white text-[9px] font-bold uppercase tracking-widest outline-none focus:border-sage shadow-sm appearance-none cursor-pointer text-gray-800"
              >
                <option value="smart">Universal Logic</option>
                <option value="carpet">Carpet / Rug (Priority)</option>
                <option value="accessories">Accessories</option>
                <option value="cushion">Soft Furnishing</option>
                <option value="bed">Bed & Textile</option>
                <option value="couch">Upholstery Focus</option>
              </select>
            </div>

            <div className="p-6 bg-sage/5 rounded-[1.5rem] border border-sage/5 space-y-3 shadow-inner relative overflow-hidden shrink-0">
               <div className="flex items-center gap-2 text-sage">
                  <Sparkles size={14} />
                  <span className="text-[8px] font-bold uppercase tracking-[0.2em]">Synthesis Active</span>
               </div>
               <p className="text-[9px] text-gray-400 leading-relaxed italic font-medium">
                 Precision framing engine calibrated for high-end assets.
               </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="shrink-0 py-3 px-16 border-t border-gray-100 bg-[#fdfdfd] flex flex-col md:flex-row justify-between items-center gap-4">
         <div className="flex flex-col gap-0.5">
            <span className="text-[#121212] font-serif italic text-lg tracking-tighter">Knot Home <span className="text-gray-300 font-light">Studio</span></span>
            <p className="text-[6px] font-bold uppercase tracking-[0.5em] text-gray-300">Proprietary Media Engine v2.5</p>
         </div>
         <div className="flex gap-8 text-[7px] font-bold uppercase tracking-[0.3em] text-gray-400">
            <span className="flex items-center gap-1.5"><div className="w-1 h-1 rounded-full bg-sage"></div> Rug Integrity Safe</span>
            <span className="flex items-center gap-1.5"><div className="w-1 h-1 rounded-full bg-black"></div> Ultra Precision</span>
            <div className="h-4 w-px bg-gray-100 mx-1"></div>
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-[#121212]">Gemini v3 Optimized</span>
            </div>
         </div>
      </footer>
    </div>
  );
};

export default App;
