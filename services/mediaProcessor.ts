
import { MediaItem, ResizeSettings } from '../types';

export async function processImage(media: MediaItem, settings: ResizeSettings): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = media.url;
    img.onload = async () => {
      // Use naturalWidth/naturalHeight to get real pixel dimensions regardless of CSS
      const sourceW = img.naturalWidth;
      const sourceH = img.naturalHeight;

      let targetWidth: number;
      let targetHeight: number;

      if (settings.ratio.targetPx) {
        targetWidth = settings.ratio.targetPx.w;
        targetHeight = settings.ratio.targetPx.h;
      } else {
        // High-res default for non-specified target sizes
        targetWidth = 2400;
        targetHeight = Math.round(targetWidth / (settings.ratio.width / settings.ratio.height));
      }
      
      const performRender = (width: number, height: number, quality: number): Promise<Blob | null> => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return Promise.resolve(null);

        // Canvas dimensions must be integers to avoid sub-pixel rendering issues
        canvas.width = Math.floor(width);
        canvas.height = Math.floor(height);
        
        // Use the actual canvas ratio to prevent squishing
        const currentTargetRatio = canvas.width / canvas.height;

        let sx: number, sy: number, sw: number, sh: number;

        if (media.cropMode === 'manual' && media.manualCrop) {
          sx = media.manualCrop.x;
          sy = media.manualCrop.y;
          sw = media.manualCrop.width;
          sh = media.manualCrop.height;
        } else {
          const focalX = media.focalPoint?.x ?? 0.5;
          const focalY = media.focalPoint?.y ?? 0.5;
          const aiScale = media.focalPoint?.scale ?? 1.0;

          // 1. Determine the maximum possible box of currentTargetRatio that fits within the source image
          const sourceRatio = sourceW / sourceH;
          let baseW, baseH;
          if (sourceRatio > currentTargetRatio) {
            baseH = sourceH;
            baseW = baseH * currentTargetRatio;
          } else {
            baseW = sourceW;
            baseH = baseW / currentTargetRatio;
          }

          // 2. Apply AI Scale (Zoom)
          const scaleFactor = 1 / Math.max(0.1, aiScale);
          sw = baseW * scaleFactor;
          sh = baseH * scaleFactor;

          // 3. Robust Aspect-Preserving Clamp
          if (sw > sourceW) {
            sw = sourceW;
            sh = sw / currentTargetRatio;
          }
          if (sh > sourceH) {
            sh = sourceH;
            sw = sh * currentTargetRatio;
          }

          // 4. Center the calculated box on the focal point
          sx = (sourceW * focalX) - (sw / 2);
          sy = (sourceH * focalY) - (sh / 2);

          // 5. Final boundary clamp for starting coordinates
          sx = Math.max(0, Math.min(sourceW - sw, sx));
          sy = Math.max(0, Math.min(sourceH - sh, sy));
        }

        // Draw using all 9 parameters to ensure precise mapping
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

        const mimeType = settings.format === 'webp' ? 'image/webp' : 
                       settings.format === 'avif' ? 'image/avif' :
                       settings.format === 'png' ? 'image/png' : 'image/jpeg';
        
        return new Promise(res => canvas.toBlob(res, mimeType, quality));
      };

      // Quality and Size Management
      let finalBlob: Blob | null = null;
      let q = 0.9;
      
      finalBlob = await performRender(targetWidth, targetHeight, q);
      
      if (finalBlob && finalBlob.size / 1024 > settings.targetFileSizeKb) {
        q = 0.6;
        finalBlob = await performRender(targetWidth, targetHeight, q);
      }
      
      // If still too large, step down resolution slightly while maintaining ratio
      if (finalBlob && finalBlob.size / 1024 > settings.targetFileSizeKb) {
        q = 0.4;
        finalBlob = await performRender(Math.floor(targetWidth * 0.8), Math.floor(targetHeight * 0.8), q);
      }

      if (finalBlob) resolve(URL.createObjectURL(finalBlob));
      else reject('Processing failed');
    };
    img.onerror = reject;
  });
}

export async function processVideo(media: MediaItem, settings: ResizeSettings): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = media.url;
    video.muted = true;
    video.crossOrigin = 'anonymous';
    
    video.onloadedmetadata = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      let targetWidth: number;
      let targetHeight: number;

      if (settings.ratio.targetPx) {
        targetWidth = settings.ratio.targetPx.w;
        targetHeight = settings.ratio.targetPx.h;
      } else {
        targetWidth = settings.ratio.width > settings.ratio.height ? 1280 : 720;
        targetHeight = Math.round(targetWidth / (settings.ratio.width / settings.ratio.height));
      }

      const targetRatio = targetWidth / targetHeight;
      canvas.width = Math.floor(targetWidth);
      canvas.height = Math.floor(targetHeight);
      
      // Use the actual canvas ratio to prevent squishing
      const currentTargetRatio = canvas.width / canvas.height;

      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => resolve(URL.createObjectURL(new Blob(chunks, { type: 'video/webm' })));

      video.play();
      recorder.start();

      const draw = () => {
        if (video.paused || video.ended) { 
          if (recorder.state !== 'inactive') recorder.stop(); 
          return; 
        }

        const vWidth = video.videoWidth;
        const vHeight = video.videoHeight;
        
        const focalX = media.focalPoint?.x ?? 0.5;
        const focalY = media.focalPoint?.y ?? 0.5;
        const aiScale = media.focalPoint?.scale ?? 1.0;

        // Same robust ratio logic as processImage
        const sourceRatio = vWidth / vHeight;
        let baseW, baseH;
        if (sourceRatio > currentTargetRatio) {
          baseH = vHeight;
          baseW = baseH * currentTargetRatio;
        } else {
          baseW = vWidth;
          baseH = baseW / currentTargetRatio;
        }

        const scaleFactor = 1 / Math.max(0.1, aiScale);
        let sw = baseW * scaleFactor;
        let sh = baseH * scaleFactor;

        if (sw > vWidth) {
          sw = vWidth;
          sh = sw / currentTargetRatio;
        }
        if (sh > vHeight) {
          sh = vHeight;
          sw = sh * currentTargetRatio;
        }

        let sx = (vWidth * focalX) - (sw / 2);
        let sy = (vHeight * focalY) - (sh / 2);

        sx = Math.max(0, Math.min(vWidth - sw, sx));
        sy = Math.max(0, Math.min(vHeight - sh, sy));

        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        requestAnimationFrame(draw);
      };
      draw();
    };
    video.onerror = reject;
  });
}
