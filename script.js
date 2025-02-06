const DITHER_ALGORITHMS = {
  "floyd-steinberg": (error, x, y, w) => [
    [7 / 16, x + 1, y],
    [3 / 16, x - 1, y + 1],
    [5 / 16, x, y + 1],
    [1 / 16, x + 1, y + 1],
  ],
  atkinson: (error, x, y, w) => [
    [1 / 8, x + 1, y],
    [1 / 8, x + 2, y],
    [1 / 8, x - 1, y + 1],
    [1 / 8, x, y + 1],
    [1 / 8, x + 1, y + 1],
    [1 / 8, x, y + 2],
  ],
  "bayer-2x2": [
    [0, 2],
    [3, 1],
  ],
  "bayer-4x4": [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ],
  ordered: [
    [0, 48, 12, 60, 3, 51, 15, 63],
    [32, 16, 44, 28, 35, 19, 47, 31],
    [8, 56, 4, 52, 11, 59, 7, 55],
    [40, 24, 36, 20, 43, 27, 39, 23],
    [2, 50, 14, 62, 1, 49, 13, 61],
    [34, 18, 46, 30, 33, 17, 45, 29],
    [10, 58, 6, 54, 9, 57, 5, 53],
    [42, 26, 38, 22, 41, 25, 37, 21],
  ],
};

const PALETTES = {
  "b&w": { fg: "#ffffff", bg: "#000000" },
  terminal: { fg: "#00ff00", bg: "#000000" },
  amber: { fg: "#ffb000", bg: "#000000" },
  "low-contrast": {
    fg: "#d36a6f",
    bg: "#15091b",
  },
  nord: {
    bg: "#2e3440",
    palette: ["#3b4252", "#434c5e", "#4c566a", "#d8dee9", "#e5e9f0"],
  },
  catppuccin: {
    bg: "#1e1e2e",
    palette: ["#cdd6f4", "#f5e0dc", "#f2cdcd", "#89b4fa"],
  },
};

class AsciiArtGenerator {
  constructor() {
    this.canvas = document.getElementById("outputCanvas");
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    this.dragArea = document.getElementById("dragArea");
    this.fileInput = document.getElementById("imageInput");

    this.blockSize = 8;
    this.brightness = 1.0;
    this.autoAdjust = true;
    this.detectEdges = false;
    this.color = true;
    this.invertColor = false;
    this.asciiChars = " .:-=+*#%@";
    this.sigma1 = 0.5;
    this.sigma2 = 1.0;
    this.ditherAlgo = "none";
    this.palette = "original";
    this.fgColor = "#ffffff";
    this.bgColor = "#000000";

    // error diffusion
    this.errorBuffer = null;

    this.setupEventListeners();
  }

  setupEventListeners() {
    this.dragArea.addEventListener("click", () => this.fileInput.click());
    this.dragArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      this.dragArea.style.borderColor = "var(--accent)";
    });
    this.dragArea.addEventListener("dragleave", () => {
      this.dragArea.style.borderColor = "var(--border-color)";
    });
    this.dragArea.addEventListener("drop", (e) => {
      e.preventDefault();
      this.dragArea.style.borderColor = "var(--border-color)";
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) {
        this.handleFile(file);
      }
    });

    this.fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) this.handleFile(file);
    });

    document.getElementById("blockSize").addEventListener("input", (e) => {
      this.blockSize = parseInt(e.target.value);
      document.getElementById("blockSizeValue").textContent = this.blockSize;
      if (this.originalImage) this.generate();
    });

    document.getElementById("brightness").addEventListener("input", (e) => {
      this.brightness = parseFloat(e.target.value);
      document.getElementById("brightnessValue").textContent =
        this.brightness.toFixed(1);
      if (this.originalImage) this.generate();
    });

    document.getElementById("autoAdjust").addEventListener("change", (e) => {
      this.autoAdjust = e.target.checked;
      if (this.originalImage) this.generate();
    });

    const sigmaControls = document.getElementById("sigmaControls");

    document.getElementById("detectEdges").addEventListener("change", (e) => {
      this.detectEdges = e.target.checked;
      sigmaControls.classList.toggle("active", e.target.checked);
      if (this.originalImage) this.generate();
    });

    document.getElementById("sigma1").addEventListener("input", (e) => {
      this.sigma1 = parseFloat(e.target.value);
      document.getElementById("sigma1Value").textContent =
        this.sigma1.toFixed(1);
      if (this.originalImage) this.generate();
    });

    document.getElementById("sigma2").addEventListener("input", (e) => {
      this.sigma2 = parseFloat(e.target.value);
      document.getElementById("sigma2Value").textContent =
        this.sigma2.toFixed(1);
      if (this.originalImage) this.generate();
    });

    document.getElementById("color").addEventListener("change", (e) => {
      this.color = e.target.checked;
      if (this.originalImage) this.generate();
    });

    document.getElementById("invertColor").addEventListener("change", (e) => {
      this.invertColor = e.target.checked;
      if (this.originalImage) this.generate();
    });

    document.getElementById("asciiChars").addEventListener("input", (e) => {
      this.asciiChars = e.target.value;
      if (this.originalImage) this.generate();
    });

    document
      .getElementById("downloadBtn")
      .addEventListener("click", () => this.downloadImage());

    document.getElementById("ditherAlgo").addEventListener("change", (e) => {
      this.ditherAlgo = e.target.value;
      if (this.originalImage) this.generate();
    });

    document.getElementById("colorPalette").addEventListener("change", (e) => {
      this.palette = e.target.value;
      if (this.palette !== "custom") {
        const colors = PALETTES[this.palette];
        if (colors.fg && colors.bg) {
          this.fgColor = colors.fg;
          this.bgColor = colors.bg;
          document.getElementById("fgColor").value = colors.fg;
          document.getElementById("bgColor").value = colors.bg;
        }
      }
      if (this.originalImage) this.generate();
    });

    document.getElementById("fgColor").addEventListener("input", (e) => {
      this.fgColor = e.target.value;
      if (this.originalImage) this.generate();
    });

    document.getElementById("bgColor").addEventListener("input", (e) => {
      this.bgColor = e.target.value;
      if (this.originalImage) this.generate();
    });

    document
      .getElementById("copyBtn")
      .addEventListener("click", () => this.copyImage());
  }

  async handleFile(file) {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await new Promise((resolve) => (img.onload = resolve));
    this.originalImage = img;
    this.generate();
  }

  async handleImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await new Promise((resolve) => (img.onload = resolve));
      this.originalImage = img;
      this.generate();
    }
  }

  rgbToGrayscale(imageData) {
    const gray = new Uint8Array(imageData.width * imageData.height);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      gray[i / 4] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }
    return gray;
  }

  gaussianKernel(sigma) {
    const size = Math.ceil(6 * sigma);
    const kernel = new Float32Array(size);
    const half = size / 2;
    let sum = 0;

    for (let i = 0; i < size; i++) {
      const x = i - half;
      kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
      sum += kernel[i];
    }

    for (let i = 0; i < size; i++) {
      kernel[i] /= sum;
    }

    return kernel;
  }

  applyGaussianBlur(imageData, sigma) {
    const width = imageData.width;
    const height = imageData.height;
    const kernel = this.gaussianKernel(sigma);
    const temp = new Uint8Array(width * height);
    const result = new Uint8Array(width * height);
    const gray = this.rgbToGrayscale(imageData);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        for (let i = 0; i < kernel.length; i++) {
          const ix = x + i - Math.floor(kernel.length / 2);
          if (ix >= 0 && ix < width) {
            sum += gray[y * width + ix] * kernel[i];
          }
        }
        temp[y * width + x] = sum;
      }
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        for (let i = 0; i < kernel.length; i++) {
          const iy = y + i - Math.floor(kernel.length / 2);
          if (iy >= 0 && iy < height) {
            sum += temp[iy * width + x] * kernel[i];
          }
        }
        result[y * width + x] = sum;
      }
    }

    return result;
  }

  differenceOfGaussians(imageData) {
    const blur1 = this.applyGaussianBlur(imageData, this.sigma1);
    const blur2 = this.applyGaussianBlur(imageData, this.sigma2);
    const result = new Uint8Array(imageData.width * imageData.height);

    for (let i = 0; i < result.length; i++) {
      const diff = blur1[i] - blur2[i];
      result[i] = Math.max(0, Math.min(255, diff + 128));
    }

    return result;
  }

  applySobelFilter(grayData, width, height) {
    const Gx = [
      [-1, 0, 1],
      [-2, 0, 2],
      [-1, 0, 1],
    ];
    const Gy = [
      [-1, -2, -1],
      [0, 0, 0],
      [1, 2, 1],
    ];
    const magnitude = new Float32Array(width * height);
    const direction = new Float32Array(width * height);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0,
          gy = 0;

        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) {
            const pixel = grayData[(y + i - 1) * width + (x + j - 1)];
            gx += Gx[i][j] * pixel;
            gy += Gy[i][j] * pixel;
          }
        }

        magnitude[y * width + x] = Math.sqrt(gx * gx + gy * gy);
        direction[y * width + x] = Math.atan2(gy, gx);
      }
    }

    return { magnitude, direction };
  }

  getEdgeChar(magnitude, direction) {
    const threshold = 50;
    if (magnitude < threshold && !this.thresholdDisabled) {
      return null;
    }

    const angle = (direction + Math.PI) * (180 / Math.PI);
    const index = Math.floor(((angle + 22.5) % 180) / 45);

    return ["-", "\\", "|", "/", "-", "\\", "|", "/"][index];
  }

  autoBrightnessContrast(imageData) {
    const gray = this.rgbToGrayscale(imageData);
    const histogram = new Array(256).fill(0);

    for (let i = 0; i < gray.length; i++) {
      histogram[gray[i]]++;
    }

    const accumulator = new Array(256);
    accumulator[0] = histogram[0];
    for (let i = 1; i < 256; i++) {
      accumulator[i] = accumulator[i - 1] + histogram[i];
    }

    const max = accumulator[255];
    const clipPercent = 1;
    const clipHistCount = Math.floor((max * clipPercent) / 100 / 2);

    let minGray = 0;
    while (accumulator[minGray] < clipHistCount) minGray++;

    let maxGray = 255;
    while (accumulator[maxGray] >= max - clipHistCount) maxGray--;

    const alpha = 255 / (maxGray - minGray);
    const beta = -minGray * alpha;

    const result = new Uint8ClampedArray(imageData.data.length);
    for (let i = 0; i < imageData.data.length; i++) {
      result[i] = imageData.data[i] * alpha + beta;
    }

    return new ImageData(result, imageData.width, imageData.height);
  }

  calculateBlockInfo(imageData, x, y, edgeData = null) {
    const width = imageData.width;
    const height = imageData.height;
    const blockW = Math.min(this.blockSize, width - x);
    const blockH = Math.min(this.blockSize, height - y);

    let sumBrightness = 0;
    let sumColor = [0, 0, 0];
    let pixelCount = 0;
    let sumMag = 0;
    let sumDir = 0;

    for (let dy = 0; dy < blockH; dy++) {
      for (let dx = 0; dx < blockW; dx++) {
        const ix = x + dx;
        const iy = y + dy;
        const i = (iy * width + ix) * 4;

        if (ix >= width || iy >= height || i + 2 >= imageData.data.length)
          continue;

        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

        sumBrightness += gray;
        if (this.color) {
          sumColor[0] += r;
          sumColor[1] += g;
          sumColor[2] += b;
        }

        if (this.detectEdges && edgeData) {
          const edgeIndex = iy * width + ix;
          sumMag += edgeData.magnitude[edgeIndex];
          sumDir += edgeData.direction[edgeIndex];
        }

        pixelCount++;
      }
    }

    return {
      sumBrightness,
      sumColor,
      pixelCount,
      sumMag,
      sumDir,
    };
  }

  selectAsciiChar(blockInfo) {
    const avgBrightness = Math.floor(
      blockInfo.sumBrightness / blockInfo.pixelCount,
    );
    const boostedBrightness = Math.floor(avgBrightness * this.brightness);
    const clampedBrightness = Math.max(0, Math.min(255, boostedBrightness));

    if (this.detectEdges) {
      const avgMag = blockInfo.sumMag / blockInfo.pixelCount;
      const avgDir = blockInfo.sumDir / blockInfo.pixelCount;
      const edgeChar = this.getEdgeChar(avgMag, avgDir);
      if (edgeChar) return edgeChar;
    }

    if (clampedBrightness === 0) return " ";
    const charIndex = Math.floor(
      (clampedBrightness * this.asciiChars.length) / 256,
    );
    return this.asciiChars[Math.min(charIndex, this.asciiChars.length - 1)];
  }

  calculateAverageColor(blockInfo) {
    if (!this.color) return [255, 255, 255];

    const color = blockInfo.sumColor.map((sum) =>
      Math.floor(sum / blockInfo.pixelCount),
    );
    if (this.invertColor) {
      return color.map((c) => 255 - c);
    }
    return color;
  }

  async generate() {
    if (!this.originalImage) return;

    const scaleFactor = 4;
    const width = this.originalImage.width;
    const height = this.originalImage.height;
    this.canvas.width = width;
    this.canvas.height = height;

    this.ctx.drawImage(this.originalImage, 0, 0);
    let imageData = this.ctx.getImageData(0, 0, width, height);

    if (this.autoAdjust) {
      imageData = this.autoBrightnessContrast(imageData);
    }

    imageData = this.applyDithering(imageData, width, height);

    imageData = this.applyColorPalette(imageData);

    let edgeData = null;
    if (this.detectEdges) {
      const dogResult = this.differenceOfGaussians(imageData);
      edgeData = this.applySobelFilter(dogResult, width, height);
    }

    const outCanvas = document.createElement("canvas");
    outCanvas.width = width * scaleFactor;
    outCanvas.height = height * scaleFactor;
    const outCtx = outCanvas.getContext("2d");
    outCtx.scale(scaleFactor, scaleFactor);
    const outImageData = outCtx.createImageData(width, height);

    for (let y = 0; y < height; y += this.blockSize) {
      for (let x = 0; x < width; x += this.blockSize) {
        const blockInfo = this.calculateBlockInfo(imageData, x, y, edgeData);
        const char = this.selectAsciiChar(blockInfo);
        const color = this.calculateAverageColor(blockInfo);

        outCtx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
        outCtx.font = `${this.blockSize}px monospace`;
        outCtx.fillText(char, x, y + this.blockSize);
      }
    }

    this.ctx.clearRect(0, 0, width, height);
    this.ctx.fillStyle = this.invertColor ? "#ffffff" : "#000000";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.drawImage(
      outCanvas,
      0,
      0,
      outCanvas.width,
      outCanvas.height,
      0,
      0,
      this.canvas.width,
      this.canvas.height,
    );
  }

  downloadImage() {
    if (!this.canvas.toDataURL) return;

    const link = document.createElement("a");
    link.download = "ascii-art.png";
    link.href = this.canvas.toDataURL("image/png");
    link.click();
  }

  async copyImage() {
    try {
      const blob = await new Promise((resolve) => this.canvas.toBlob(resolve));
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }

  applyColorPalette(imageData) {
    const data = new Uint8ClampedArray(imageData.data);

    if (this.palette === "original") {
      return imageData;
    }

    const paletteConfig = PALETTES[this.palette];

    if (paletteConfig.fg && paletteConfig.bg) {
      for (let i = 0; i < data.length; i += 4) {
        const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
        const color = brightness > 127 ? paletteConfig.fg : paletteConfig.bg;
        const rgb = this.hexToRgb(color);
        data[i] = rgb.r;
        data[i + 1] = rgb.g;
        data[i + 2] = rgb.b;
      }
    } else if (paletteConfig.palette) {
      const bg = paletteConfig.bg
        ? this.hexToRgb(paletteConfig.bg)
        : { r: 0, g: 0, b: 0 };
      for (let i = 0; i < data.length; i += 4) {
        const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
        if (brightness < 20) {
          data[i] = bg.r;
          data[i + 1] = bg.g;
          data[i + 2] = bg.b;
        } else {
          const paletteIndex = Math.floor(
            (brightness / 256) * paletteConfig.palette.length,
          );
          const color = this.hexToRgb(paletteConfig.palette[paletteIndex]);
          data[i] = color.r;
          data[i + 1] = color.g;
          data[i + 2] = color.b;
        }
      }
    }

    return new ImageData(data, imageData.width, imageData.height);
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 };
  }

  applyDithering(imageData, width, height) {
    if (this.ditherAlgo === "none") return imageData;

    const data = new Uint8ClampedArray(imageData.data);
    this.errorBuffer = new Float32Array(width * height * 4);

    if (this.ditherAlgo.startsWith("bayer")) {
      return this.applyBayerDithering(data, width, height);
    } else if (this.ditherAlgo === "ordered") {
      return this.applyOrderedDithering(data, width, height);
    }

    const matrix = DITHER_ALGORITHMS[this.ditherAlgo];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;

        for (let c = 0; c < 3; c++) {
          const oldPixel = data[i + c] + this.errorBuffer[i + c];
          const newPixel = oldPixel > 127 ? 255 : 0;
          const error = oldPixel - newPixel;

          data[i + c] = newPixel;

          matrix(error, x, y, width).forEach(([factor, dx, dy]) => {
            if (dx >= 0 && dx < width && dy >= 0 && dy < height) {
              const di = (dy * width + dx) * 4;
              this.errorBuffer[di + c] += error * factor;
            }
          });
        }
      }
    }

    return new ImageData(data, width, height);
  }

  applyBayerDithering(data, width, height) {
    const matrix = DITHER_ALGORITHMS[this.ditherAlgo];
    const matrixSize = matrix.length;
    const divisor = matrixSize * matrixSize + 1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const threshold = matrix[y % matrixSize][x % matrixSize] / divisor;

        for (let c = 0; c < 3; c++) {
          const oldPixel = data[i + c] / 255;
          data[i + c] = oldPixel > threshold ? 255 : 0;
        }
      }
    }

    return new ImageData(data, width, height);
  }

  applyOrderedDithering(data, width, height) {
    const matrix = DITHER_ALGORITHMS.ordered;
    const matrixSize = 8;
    const levels = 64;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const threshold = matrix[y % matrixSize][x % matrixSize] / levels;

        for (let c = 0; c < 3; c++) {
          const oldPixel = data[i + c] / 255;
          data[i + c] = oldPixel > threshold ? 255 : 0;
        }
      }
    }

    return new ImageData(data, width, height);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.asciiGenerator = new AsciiArtGenerator();
});
