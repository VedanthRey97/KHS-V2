
export type MediaType = 'image' | 'video';

export interface AspectRatio {
  label: string;
  width: number;
  height: number;
  targetPx?: { w: number, h: number };
}

export const ASPECT_RATIOS: AspectRatio[] = [
  { label: '4:5', width: 1128, height: 1410, targetPx: { w: 1128, h: 1410 } },
  { label: '4:3', width: 1410, height: 1058, targetPx: { w: 1410, h: 1058 } },
];

export type ExportFormat = 'webp' | 'avif' | 'jpeg' | 'png' | 'mp4';

export type FocusSubject = 'smart' | 'cushion' | 'carpet' | 'bed' | 'couch' | 'accessories';

export type CropMode = 'smart' | 'manual';

export interface DatabaseRow {
  'Product Name'?: string;
  'Color'?: string;
  'Color Family'?: string;
  'Image Name'?: string;
  'Filename'?: string;
  [key: string]: any;
}

export interface MediaItem {
  id: string;
  file: File;
  type: MediaType;
  url: string;
  processedUrl?: string;
  status: 'idle' | 'processing' | 'done' | 'error';
  focalPoint?: { x: number; y: number; scale?: number };
  cropMode: CropMode;
  manualCrop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  productName?: string;
  productColor?: string;
  colorFamily?: string;
  imageStyle?: string;
  category?: string;
  angle?: string;
  view?: string;
}

export interface ResizeSettings {
  ratio: AspectRatio;
  format: ExportFormat;
  targetFileSizeKb: number;
  focusSubject: FocusSubject;
  fit: 'cover' | 'contain';
}

export interface ManualCropExample {
  aspectRatio: string;
  crop: { x: number; y: number; width: number; height: number };
  imageWidth: number;
  imageHeight: number;
}

export interface LearningContext {
  recentManualCrops: ManualCropExample[];
  recentOffsets: { dx: number, dy: number }[];
}
