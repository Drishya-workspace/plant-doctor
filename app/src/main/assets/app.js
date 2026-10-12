const state = {
  lang: "en",
  model: null,
  diseases: null,
  translations: null,
  imageDataUrl: "",
  latestResult: null,
  assistantKb: null,
  assistantConfig: null,
  assistantMessages: [],
  assistantDiagnosisKey: "",
  assistantMode: "offline",
  gaborKernels: null,
  gaussian11: null
};

const els = {
  modelStatus: document.getElementById("model-status"),
  lang: document.getElementById("language-select"),
  preview: document.getElementById("preview-image"),
  empty: document.getElementById("stage-empty"),
  loader: document.getElementById("image-loader"),
  clear: document.getElementById("clear-image"),
  camera: document.getElementById("camera-button"),
  gallery: document.getElementById("gallery-button"),
  analyze: document.getElementById("analyze-button"),
  overlay: document.getElementById("analysis-overlay"),
  step: document.getElementById("analysis-step"),
  result: document.getElementById("result-section"),
  resultName: document.getElementById("result-name"),
  resultCrop: document.getElementById("result-crop"),
  severity: document.getElementById("severity-badge"),
  confidenceValue: document.getElementById("confidence-value"),
  confidenceFill: document.getElementById("confidence-fill"),
  confidenceNote: document.getElementById("confidence-note"),
  symptoms: document.getElementById("result-symptoms"),
  cause: document.getElementById("result-cause"),
  remedies: document.getElementById("remedy-list"),
  alternatives: document.getElementById("alternatives"),
  share: document.getElementById("share-button"),
  aiOpen: document.getElementById("ai-open-button"),
  aiChat: document.getElementById("ai-chat"),
  aiStatus: document.getElementById("ai-status"),
  aiEndpoint: document.getElementById("ai-endpoint"),
  aiMessages: document.getElementById("ai-messages"),
  aiForm: document.getElementById("ai-form"),
  aiInput: document.getElementById("ai-input")
};

const DEFAULT_UI = {
  en: {
    headerBadge: "Offline leaf diagnosis", uploadTitle: "Leaf scan", uploadSub: "Select a clear leaf photo",
    emptyTitle: "No leaf selected", emptySub: "Use the camera or choose an existing photo", imageLoading: "Preparing image",
    cameraAction: "Take photo", cameraHint: "Open camera", galleryAction: "Upload photo", galleryHint: "Choose from gallery",
    analyzeDisease: "Analyze leaf", analyzeAgain: "Analyze again", analyzing: "Analyzing leaf", diagnosisTitle: "Diagnosis",
    modelConfidence: "Model confidence", symptomsLabel: "Symptoms", causeLabel: "Cause", remediesTitle: "Treatment plan",
    remedySubtitle: "Recommended next steps", otherMatches: "Other possible matches", crop: "Crop", severity: "severity",
    tip1: "Natural light", tip2: "Fill the frame", tip5: "Keep it sharp",
    disclaimer: "Use this result as guidance. Confirm serious disease or chemical treatment with a local agriculture professional.",
    modelReady: "Ready offline", modelLoading: "Loading model", modelError: "Model error", lowConfidence: "Retake with a sharper, closer leaf photo if this confidence looks low.",
    goodConfidence: "The image quality is usable. Check the treatment notes before taking action.", noImage: "Select or capture a leaf photo first.",
    preparing: "Preparing image features", predicting: "Running local model", complete: "Report ready"
  },
  hi: {
    headerBadge: "ऑफलाइन पत्ती निदान", uploadTitle: "पत्ती स्कैन", uploadSub: "साफ पत्ती की फोटो चुनें",
    emptyTitle: "कोई पत्ती नहीं चुनी गई", emptySub: "कैमरा खोलें या पुरानी फोटो चुनें", imageLoading: "फोटो तैयार हो रही है",
    cameraAction: "फोटो लें", cameraHint: "कैमरा खोलें", galleryAction: "फोटो अपलोड करें", galleryHint: "गैलरी से चुनें",
    analyzeDisease: "पत्ती जांचें", analyzeAgain: "फिर जांचें", analyzing: "पत्ती जांची जा रही है", diagnosisTitle: "निदान",
    modelConfidence: "मॉडल विश्वास", symptomsLabel: "लक्षण", causeLabel: "कारण", remediesTitle: "उपचार योजना",
    remedySubtitle: "सुझाए गए अगले कदम", otherMatches: "अन्य संभावित परिणाम", crop: "फसल", severity: "गंभीरता",
    tip1: "प्राकृतिक रोशनी", tip2: "फ्रेम भरें", tip5: "फोटो साफ रखें",
    disclaimer: "इस परिणाम को मार्गदर्शन की तरह उपयोग करें। गंभीर रोग या रासायनिक उपचार के लिए स्थानीय कृषि विशेषज्ञ से पुष्टि करें।",
    modelReady: "ऑफलाइन तैयार", modelLoading: "मॉडल लोड हो रहा है", modelError: "मॉडल त्रुटि", lowConfidence: "विश्वास कम लगे तो पत्ती की ज्यादा साफ और नजदीकी फोटो लें।",
    goodConfidence: "फोटो उपयोग योग्य है। उपचार करने से पहले नोट्स पढ़ें।", noImage: "पहले पत्ती की फोटो चुनें या लें।",
    preparing: "फोटो फीचर तैयार हो रहे हैं", predicting: "लोकल मॉडल चल रहा है", complete: "रिपोर्ट तैयार"
  }
};

document.addEventListener("DOMContentLoaded", init);
els.lang.addEventListener("change", () => {
  state.lang = els.lang.value;
  document.documentElement.lang = state.lang;
  applyLanguage();
  if (state.latestResult) renderResult(state.latestResult);
});
els.camera.addEventListener("click", () => window.AndroidBridge ? AndroidBridge.takePhoto() : pickImageFromBrowser(true));
els.gallery.addEventListener("click", () => window.AndroidBridge ? AndroidBridge.choosePhoto() : pickImageFromBrowser(false));
els.clear.addEventListener("click", resetImage);
els.analyze.addEventListener("click", analyzeImage);
els.share.addEventListener("click", shareReport);
els.aiOpen.addEventListener("click", openAssistant);
els.aiForm.addEventListener("submit", sendAssistantMessage);
els.aiEndpoint.addEventListener("change", saveAssistantEndpoint);
els.aiEndpoint.addEventListener("blur", saveAssistantEndpoint);
window.receiveNativeImage = (dataUrl) => loadImageDataUrl(dataUrl);
window.showImageLoading = () => { els.loader.hidden = false; };
window.hideImageLoading = () => { els.loader.hidden = true; };
window.receiveAssistantResponse = receiveAssistantResponse;
window.receiveAssistantError = receiveAssistantError;

async function init() {
  applyLanguage();
  setModelStatus(t("modelLoading"), false);
  try {
    const loaded = await Promise.all([
      loadJsonAsset("plant-model.json"),
      loadJsonAsset("diseases-en.json"),
      loadJsonAsset("translations.json"),
      loadJsonAsset("assistant-kb.json").catch(() => null),
      loadJsonAsset("assistant-config.json").catch(() => ({ endpoint: "", timeoutMs: 8000 }))
    ]);
    state.model = hydrateModel(loaded[0]);
    state.diseases = loaded[1];
    state.translations = loaded[2];
    state.assistantKb = loaded[3];
    state.assistantConfig = loaded[4] || { endpoint: "", timeoutMs: 8000 };
    state.assistantConfig.endpoint = localStorage.getItem("plantDoctorAssistantEndpoint") || state.assistantConfig.endpoint || "";
    els.aiEndpoint.value = state.assistantConfig.endpoint;
    state.gaborKernels = [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4].map(makeGaborKernel);
    state.gaussian11 = makeGaussianKernel(11, 2);
    applyLanguage();
    setModelStatus(t("modelReady"), true);
  } catch (error) {
    console.error(error);
    setModelStatus(t("modelError"), false);
    els.modelStatus.title = String(error && error.message ? error.message : error);
  }
}

function loadJsonAsset(path) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.overrideMimeType("application/json");
    request.open("GET", path, true);
    request.onload = () => {
      if (request.status === 0 || (request.status >= 200 && request.status < 300)) {
        try {
          resolve(JSON.parse(request.responseText));
        } catch (error) {
          reject(new Error(`Could not read ${path}: ${error.message}`));
        }
      } else {
        reject(new Error(`Could not load ${path} (${request.status})`));
      }
    };
    request.onerror = () => reject(new Error(`Could not load ${path}`));
    request.send();
  });
}

function hydrateModel(raw) {
  return {
    labels: raw.labels,
    nClasses: raw.nClasses,
    nStages: raw.nStages,
    learningRate: raw.learningRate,
    initRaw: raw.initRaw,
    trees: raw.trees.map((tree) => ({
      left: decodeB64(tree.l, Int16Array), right: decodeB64(tree.r, Int16Array),
      feature: decodeB64(tree.f, Int16Array), threshold: decodeB64(tree.t, Float64Array),
      value: decodeB64(tree.v, Float64Array)
    }))
  };
}

function decodeB64(value, Type) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Type(bytes.buffer);
}

function t(key) {
  const translated = state.translations && state.translations.ui && state.translations.ui[state.lang] ? state.translations.ui[state.lang] : {};
  return translated[key] || DEFAULT_UI[state.lang][key] || DEFAULT_UI.en[key] || key;
}

function applyLanguage() {
  document.querySelectorAll("[data-i18n]").forEach((node) => { node.textContent = t(node.dataset.i18n); });
  els.modelStatus.textContent = state.model ? t("modelReady") : t("modelLoading");
  els.analyze.querySelector("span").textContent = state.latestResult ? t("analyzeAgain") : t("analyzeDisease");
}

function setModelStatus(text, ready) {
  els.modelStatus.textContent = text;
  els.modelStatus.classList.toggle("ready", ready);
}

function pickImageFromBrowser(capture) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  if (capture) input.capture = "environment";
  input.onchange = () => input.files && input.files[0] && readFile(input.files[0]);
  input.click();
}

function readFile(file) {
  const reader = new FileReader();
  reader.onload = () => loadImageDataUrl(reader.result);
  reader.readAsDataURL(file);
}

function loadImageDataUrl(dataUrl) {
  state.imageDataUrl = dataUrl;
  els.preview.src = dataUrl;
  els.preview.hidden = false;
  els.empty.hidden = true;
  els.loader.hidden = true;
  els.clear.hidden = false;
  els.analyze.disabled = !state.model;
  els.result.hidden = true;
  state.latestResult = null;
  clearAssistantSession();
  els.analyze.querySelector("span").textContent = t("analyzeDisease");
}

function resetImage() {
  state.imageDataUrl = "";
  state.latestResult = null;
  els.preview.removeAttribute("src");
  els.preview.hidden = true;
  els.empty.hidden = false;
  els.loader.hidden = true;
  els.clear.hidden = true;
  els.analyze.disabled = true;
  els.result.hidden = true;
  clearAssistantSession();
  els.analyze.querySelector("span").textContent = t("analyzeDisease");
}

async function analyzeImage() {
  if (!state.imageDataUrl) return alert(t("noImage"));
  if (!state.model) return;
  showOverlay(t("preparing"));
  els.analyze.disabled = true;
  try {
    await nextFrame();
    const image = await loadImage(state.imageDataUrl);
    const data = imageToImageData(image, 128, 128);
    const features = extractFeatures(data);
    setAnalysisStep(t("predicting"));
    await nextFrame();
    const prediction = predict(features);
    const label = prediction.label;
    const info = state.diseases[label] || fallbackInfo(label);
    const result = {
      label,
      confidence: round1(prediction.confidence * 100),
      top3: prediction.top3.map((item) => ({ label: item.label, confidence: round1(item.confidence * 100) })),
      info,
      severityColor: severityColor(info.severity)
    };
    state.latestResult = result;
    renderResult(result);
    setAnalysisStep(t("complete"));
  } catch (error) {
    console.error(error);
    alert(String(error && error.message ? error.message : error));
  } finally {
    hideOverlay();
    els.analyze.disabled = false;
    els.analyze.querySelector("span").textContent = t("analyzeAgain");
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function imageToImageData(img, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

function predict(features) {
  const raw = state.model.initRaw.slice();
  const model = state.model;
  for (let stage = 0; stage < model.nStages; stage += 1) {
    for (let klass = 0; klass < model.nClasses; klass += 1) {
      raw[klass] += model.learningRate * treePredict(model.trees[stage * model.nClasses + klass], features);
    }
  }
  const probs = softmax(raw);
  const ranked = probs.map((confidence, index) => ({ label: model.labels[index], confidence, index })).sort((a, b) => b.confidence - a.confidence);
  return { label: ranked[0].label, confidence: ranked[0].confidence, top3: ranked.slice(0, 3), probs };
}

function treePredict(tree, features) {
  let node = 0;
  while (tree.left[node] !== -1) {
    const featureIndex = tree.feature[node];
    node = features[featureIndex] <= tree.threshold[node] ? tree.left[node] : tree.right[node];
  }
  return tree.value[node];
}

function softmax(raw) {
  const max = Math.max.apply(null, raw);
  const exp = raw.map((value) => Math.exp(value - max));
  const total = exp.reduce((sum, value) => sum + value, 0);
  return exp.map((value) => value / total);
}

function extractFeatures(imageData) {
  const rgba = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const gray = new Uint8Array(width * height);
  const hsv = new Float64Array(width * height * 3);
  for (let i = 0, p = 0; i < rgba.length; i += 4, p += 1) {
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
    gray[p] = Math.max(0, Math.min(255, Math.round(0.299 * r + 0.587 * g + 0.114 * b)));
    const converted = rgbToOpenCvHsv(r, g, b);
    hsv[p * 3] = converted[0];
    hsv[p * 3 + 1] = converted[1];
    hsv[p * 3 + 2] = converted[2];
  }
  return [].concat(hsvHistogram(hsv), gaborFeatures(gray, width, height), glcmFeatures(gray, width, height), spotFeatures(gray, width, height));
}

function rgbToOpenCvHsv(r, g, b) {
  const rf = r / 255, gf = g / 255, bf = b / 255;
  const max = Math.max(rf, gf, bf), min = Math.min(rf, gf, bf), delta = max - min;
  let hue = 0;
  if (delta !== 0) {
    if (max === rf) hue = 60 * (((gf - bf) / delta) % 6);
    else if (max === gf) hue = 60 * ((bf - rf) / delta + 2);
    else hue = 60 * ((rf - gf) / delta + 4);
  }
  if (hue < 0) hue += 360;
  return [hue / 2, max === 0 ? 0 : (delta / max) * 255, max * 255];
}

function hsvHistogram(hsv) {
  const hist = new Float64Array(512);
  for (let p = 0; p < hsv.length; p += 3) {
    const h = Math.min(7, Math.floor(hsv[p] / 22.5));
    const s = Math.min(7, Math.floor(hsv[p + 1] / 32));
    const v = Math.min(7, Math.floor(hsv[p + 2] / 32));
    hist[h * 64 + s * 8 + v] += 1;
  }
  let norm = 0;
  for (const value of hist) norm += value * value;
  norm = Math.sqrt(norm) || 1;
  return Array.from(hist, (value) => value / norm);
}

function makeGaborKernel(theta) {
  const size = 21, sigma = 5, lambda = 10, gamma = 0.5, psi = 0;
  const half = Math.floor(size / 2);
  const kernel = new Float64Array(size * size);
  let k = 0;
  for (let y = -half; y <= half; y += 1) {
    for (let x = -half; x <= half; x += 1) {
      const xr = x * Math.cos(theta) + y * Math.sin(theta);
      const yr = -x * Math.sin(theta) + y * Math.cos(theta);
      kernel[k++] = Math.exp(-(xr * xr + gamma * gamma * yr * yr) / (2 * sigma * sigma)) * Math.cos((2 * Math.PI * xr) / lambda + psi);
    }
  }
  return { kernel, size, half };
}

function gaborFeatures(gray, width, height) {
  const features = [];
  for (const spec of state.gaborKernels) {
    let sum = 0, sumSq = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let acc = 0, k = 0;
        for (let ky = -spec.half; ky <= spec.half; ky += 1) {
          const yy = reflect101(y + ky, height);
          for (let kx = -spec.half; kx <= spec.half; kx += 1) {
            const xx = reflect101(x + kx, width);
            acc += gray[yy * width + xx] * spec.kernel[k++];
          }
        }
        sum += acc; sumSq += acc * acc;
      }
    }
    const n = width * height;
    const meanValue = sum / n;
    features.push(meanValue, Math.sqrt(Math.max(0, sumSq / n - meanValue * meanValue)));
  }
  return features;
}

function reflect101(value, size) {
  if (size <= 1) return 0;
  while (value < 0 || value >= size) value = value < 0 ? -value : 2 * size - value - 2;
  return value;
}

function glcmFeatures(gray, width, height) {
  const matrices = [new Float64Array(64), new Float64Array(64)];
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width - 1; x += 1) addGlcmPair(matrices[0], gray[y * width + x] >> 5, gray[y * width + x + 1] >> 5);
  for (let y = 0; y < height - 1; y += 1) for (let x = 0; x < width; x += 1) addGlcmPair(matrices[1], gray[y * width + x] >> 5, gray[(y + 1) * width + x] >> 5);
  const props = matrices.map(glcmProps);
  return [0, 1, 2, 3, 4].map((i) => (props[0][i] + props[1][i]) / 2);
}

function addGlcmPair(matrix, a, b) { matrix[a * 8 + b] += 1; matrix[b * 8 + a] += 1; }

function glcmProps(matrix) {
  let total = 0;
  for (const value of matrix) total += value;
  if (!total) return [0, 0, 0, 0, 1];
  for (let i = 0; i < matrix.length; i += 1) matrix[i] /= total;
  let contrast = 0, dissimilarity = 0, homogeneity = 0, asm = 0, meanI = 0, meanJ = 0;
  for (let i = 0; i < 8; i += 1) for (let j = 0; j < 8; j += 1) {
    const p = matrix[i * 8 + j], diff = i - j;
    contrast += p * diff * diff; dissimilarity += p * Math.abs(diff); homogeneity += p / (1 + diff * diff); asm += p * p; meanI += i * p; meanJ += j * p;
  }
  let varI = 0, varJ = 0, cov = 0;
  for (let i = 0; i < 8; i += 1) for (let j = 0; j < 8; j += 1) {
    const p = matrix[i * 8 + j];
    varI += (i - meanI) * (i - meanI) * p; varJ += (j - meanJ) * (j - meanJ) * p; cov += (i - meanI) * (j - meanJ) * p;
  }
  return [contrast, dissimilarity, homogeneity, Math.sqrt(asm), varI > 1e-15 && varJ > 1e-15 ? cov / Math.sqrt(varI * varJ) : 1];
}

function makeGaussianKernel(size, sigma) {
  const half = Math.floor(size / 2);
  const kernel = new Float64Array(size * size);
  let sum = 0, k = 0;
  for (let y = -half; y <= half; y += 1) for (let x = -half; x <= half; x += 1) {
    const value = Math.exp(-(x * x + y * y) / (2 * sigma * sigma));
    kernel[k++] = value; sum += value;
  }
  for (let i = 0; i < kernel.length; i += 1) kernel[i] /= sum;
  return { kernel, size, half };
}

function spotFeatures(gray, width, height) {
  const threshold = adaptiveBinaryInv(gray, width, height);
  const opened = dilate(erode(threshold, width, height), width, height);
  const components = connectedComponents(opened, gray, width, height).filter((component) => component.area > 5 && component.area < 500);
  if (!components.length) return [0, 0, 0, 0, 0, 0, 0];
  const areas = components.map((c) => c.area);
  const circularities = components.map((c) => c.perimeter > 0 ? 4 * Math.PI * c.area / (c.perimeter * c.perimeter) : 0);
  const spotColors = components.slice(0, 10).map((c) => c.graySum / c.area);
  return [components.length, mean(areas), std(areas), mean(circularities), std(circularities), mean(spotColors), std(spotColors)];
}

function adaptiveBinaryInv(gray, width, height) {
  const result = new Uint8Array(width * height);
  const spec = state.gaussian11;
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    let weighted = 0, k = 0;
    for (let ky = -spec.half; ky <= spec.half; ky += 1) {
      const yy = clamp(y + ky, 0, height - 1);
      for (let kx = -spec.half; kx <= spec.half; kx += 1) {
        const xx = clamp(x + kx, 0, width - 1);
        weighted += gray[yy * width + xx] * spec.kernel[k++];
      }
    }
    result[y * width + x] = gray[y * width + x] > weighted - 2 ? 0 : 1;
  }
  return result;
}

const MORPH = [[0, -1], [-1, 0], [0, 0], [1, 0], [0, 1]];
function erode(binary, width, height) {
  const out = new Uint8Array(binary.length);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    let ok = 1;
    for (const item of MORPH) {
      const xx = x + item[0], yy = y + item[1];
      if (xx < 0 || yy < 0 || xx >= width || yy >= height || !binary[yy * width + xx]) { ok = 0; break; }
    }
    out[y * width + x] = ok;
  }
  return out;
}

function dilate(binary, width, height) {
  const out = new Uint8Array(binary.length);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    let ok = 0;
    for (const item of MORPH) {
      const xx = x + item[0], yy = y + item[1];
      if (xx >= 0 && yy >= 0 && xx < width && yy < height && binary[yy * width + xx]) { ok = 1; break; }
    }
    out[y * width + x] = ok;
  }
  return out;
}

function connectedComponents(binary, gray, width, height) {
  const seen = new Uint8Array(binary.length), components = [], qx = [], qy = [];
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const start = y * width + x;
    if (!binary[start] || seen[start]) continue;
    let head = 0, area = 0, perimeter = 0, graySum = 0;
    qx.length = 0; qy.length = 0; qx.push(x); qy.push(y); seen[start] = 1;
    while (head < qx.length) {
      const cx = qx[head], cy = qy[head++], idx = cy * width + cx;
      area += 1; graySum += gray[idx];
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = ny * width + nx;
        if (binary[ni] && !seen[ni]) { seen[ni] = 1; qx.push(nx); qy.push(ny); }
      }
      for (const item of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = cx + item[0], ny = cy + item[1];
        if (nx < 0 || ny < 0 || nx >= width || ny >= height || !binary[ny * width + nx]) perimeter += 1;
      }
    }
    components.push({ area, perimeter, graySum });
  }
  return components;
}

function renderResult(data) {
  const info = localizedInfo(data.info);
  prepareAssistantForDiagnosis(data);
  els.result.hidden = false;
  els.resultName.textContent = localizedName(data.info.common_name);
  els.resultCrop.textContent = t("crop") + ": " + localizedName(data.info.crop);
  els.severity.textContent = localizedName(data.info.severity) + " " + t("severity");
  els.severity.style.background = data.severityColor + "22";
  els.severity.style.color = data.severityColor;
  els.confidenceValue.textContent = data.confidence + "%";
  els.confidenceFill.style.width = data.confidence + "%";
  els.confidenceFill.style.background = data.confidence > 85 ? "var(--green)" : data.confidence > 60 ? "var(--amber)" : "var(--red)";
  els.confidenceNote.textContent = data.confidence > 70 ? t("goodConfidence") : t("lowConfidence");
  els.symptoms.textContent = info.symptoms;
  els.cause.textContent = info.cause;
  els.remedies.innerHTML = info.remedies.map((item) => "<li>" + escapeHtml(item) + "</li>").join("");
  els.alternatives.innerHTML = data.top3.map((item) => {
    const altInfo = state.diseases[item.label] || fallbackInfo(item.label);
    return "<div class=\"alternative-row\"><span>" + escapeHtml(localizedName(altInfo.common_name)) + "</span><strong>" + item.confidence + "%</strong><div class=\"alternative-bar\"><span style=\"width:" + item.confidence + "%\"></span></div></div>";
  }).join("");
  els.result.scrollIntoView({ behavior: "smooth", block: "start" });
}

function localizedInfo(info) {
  if (state.lang !== "hi" || !state.translations) return info;
  const hi = state.translations.infoHi;
  if (info.severity === "None") return { ...info, symptoms: hi.healthySymptoms, cause: hi.healthyCause, remedies: hi.healthyRemedies };
  const disease = hi.diseases && hi.diseases[info.common_name];
  return disease ? { ...info, ...disease } : { ...info, cause: info.cause === "N/A" ? hi.healthyCause : info.cause };
}

function localizedName(value) {
  if (state.lang !== "hi" || !state.translations) return value;
  return state.translations.namesHi[value] || value;
}

function fallbackInfo(label) {
  return { common_name: label.replace(/_/g, " "), crop: "Unknown", severity: "Unknown", symptoms: "No information available.", cause: "Unknown", remedies: ["Consult a local agricultural extension office."] };
}

function severityColor(severity) {
  return { None: "#167a4a", Medium: "#b96b19", High: "#b43b35", Critical: "#6f46b6", Unknown: "#657168" }[severity] || "#657168";
}

function prepareAssistantForDiagnosis(data) {
  const key = data.label + "|" + data.confidence + "|" + data.top3.map((item) => item.label + ":" + item.confidence).join(",");
  if (state.assistantDiagnosisKey === key) return;
  state.assistantDiagnosisKey = key;
  state.assistantMessages = [];
  state.assistantMode = "offline";
  els.aiChat.hidden = true;
  els.aiInput.value = "";
  setAssistantStatus("Offline assistant", "offline");
  renderAssistantMessages();
}

function clearAssistantSession() {
  state.assistantDiagnosisKey = "";
  state.assistantMessages = [];
  state.assistantMode = "offline";
  els.aiChat.hidden = true;
  els.aiInput.value = "";
  renderAssistantMessages();
  setAssistantStatus("Offline assistant", "offline");
}

function openAssistant() {
  if (!state.latestResult) return;
  els.aiChat.hidden = !els.aiChat.hidden;
  if (!els.aiChat.hidden && state.assistantMessages.length === 0) {
    addAssistantMessage("assistant", initialAssistantGreeting(), "offline");
  }
  if (!els.aiChat.hidden) {
    renderAssistantMessages();
    els.aiInput.focus();
  }
}

async function sendAssistantMessage(event) {
  event.preventDefault();
  const text = els.aiInput.value.trim();
  if (!text || !state.latestResult) return;
  els.aiInput.value = "";
  addAssistantMessage("user", text, "user");
  setAssistantStatus("Connecting online...", "connecting");

  try {
    const onlineReply = await askOnlineAssistant(text);
    if (onlineReply) {
      state.assistantMode = "online";
      addAssistantMessage("assistant", onlineReply, "online");
      setAssistantStatus("AI assistant: Online", "");
      return;
    }
    throw new Error("Online assistant unavailable");
  } catch (error) {
    state.assistantMode = "offline";
    const reply = answerOffline(text);
    const reason = error && error.message ? error.message : "Online assistant unavailable";
    addAssistantMessage("assistant", `Online AI was not reachable (${reason}). Continuing with the offline assistant.\n\n${reply}`, "offline");
    setAssistantStatus("Offline assistant", "offline");
  }
}

function initialAssistantGreeting() {
  const context = buildAssistantContext();
  const top = context.probabilities.slice(0, 3).map((item) => `${item.name} ${item.confidence}%`).join(", ");
  return `I can help with follow-up care for this result. Current ML prediction: ${context.disease} (${context.confidence}% confidence). Other possible matches: ${top}. Tell me about rainfall, watering, growth stage, or growing conditions if you want more specific advice.`;
}

function addAssistantMessage(role, text, mode) {
  state.assistantMessages.push({ role, text, mode, at: Date.now() });
  renderAssistantMessages();
}

function renderAssistantMessages() {
  els.aiMessages.innerHTML = state.assistantMessages.map((message) => {
    const label = message.role === "assistant" && message.mode === "offline" ? "Offline assistant" : "";
    return `<div class="ai-message ${message.role}">${label ? `<strong>${label}</strong>\n` : ""}${escapeHtml(message.text)}</div>`;
  }).join("");
  els.aiMessages.scrollTop = els.aiMessages.scrollHeight;
}

function setAssistantStatus(text, mode) {
  els.aiStatus.textContent = text;
  els.aiStatus.classList.toggle("offline", mode === "offline");
  els.aiStatus.classList.toggle("error", mode === "error");
  els.aiStatus.classList.toggle("connecting", mode === "connecting");
}

function buildAssistantContext() {
  const result = state.latestResult;
  const info = localizedInfo(result.info);
  return {
    label: result.label,
    disease: localizedName(result.info.common_name),
    crop: localizedName(result.info.crop),
    confidence: result.confidence,
    probabilities: result.top3.map((item) => {
      const altInfo = state.diseases[item.label] || fallbackInfo(item.label);
      return { label: item.label, name: localizedName(altInfo.common_name), confidence: item.confidence };
    }),
    symptoms: info.symptoms,
    cause: info.cause,
    recommendations: info.remedies,
    severity: localizedName(result.info.severity)
  };
}

function askOnlineAssistant(question) {
  const endpoint = currentAssistantEndpoint();
  if (!endpoint) return Promise.reject(new Error("backend URL not configured"));
  const timeoutMs = Number(state.assistantConfig.timeoutMs || 8000);
  const payload = {
    question,
    diagnosis: buildAssistantContext(),
    history: state.assistantMessages.slice(-10).map((message) => ({ role: message.role, content: message.text }))
  };
  return postJson(endpoint, payload, timeoutMs).then((data) => data && typeof data.answer === "string" ? data.answer : null);
}

function currentAssistantEndpoint() {
  const endpoint = els.aiEndpoint.value.trim();
  if (state.assistantConfig) state.assistantConfig.endpoint = endpoint;
  return endpoint;
}

function saveAssistantEndpoint() {
  const endpoint = currentAssistantEndpoint();
  localStorage.setItem("plantDoctorAssistantEndpoint", endpoint);
}

function postJson(url, payload, timeoutMs) {
  if (window.AndroidBridge && typeof AndroidBridge.askPlantAssistant === "function") {
    return postJsonViaAndroid(url, payload, timeoutMs);
  }
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", url, true);
    request.timeout = timeoutMs;
    request.setRequestHeader("Content-Type", "application/json");
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        try { resolve(JSON.parse(request.responseText)); }
        catch (error) { reject(error); }
      } else {
        reject(new Error("Assistant backend returned " + request.status));
      }
    };
    request.onerror = () => reject(new Error("Assistant backend unreachable"));
    request.ontimeout = () => reject(new Error("Assistant backend timed out"));
    request.send(JSON.stringify(payload));
  });
}

const assistantRequests = {};

function postJsonViaAndroid(url, payload, timeoutMs) {
  return new Promise((resolve, reject) => {
    const requestId = "ai_" + Date.now() + "_" + Math.random().toString(36).slice(2);
    assistantRequests[requestId] = { resolve, reject };
    AndroidBridge.askPlantAssistant(requestId, url, JSON.stringify(payload), timeoutMs);
    window.setTimeout(() => {
      if (assistantRequests[requestId]) {
        delete assistantRequests[requestId];
        reject(new Error("backend timed out"));
      }
    }, timeoutMs + 1500);
  });
}

function receiveAssistantResponse(requestId, data) {
  const pending = assistantRequests[requestId];
  if (!pending) return;
  delete assistantRequests[requestId];
  pending.resolve(data);
}

function receiveAssistantError(requestId, message) {
  const pending = assistantRequests[requestId];
  if (!pending) return;
  delete assistantRequests[requestId];
  pending.reject(new Error(message || "backend unreachable"));
}

function answerOffline(question) {
  const context = buildAssistantContext();
  const entry = findKnowledgeEntry(context.label, context.disease);
  const q = question.toLowerCase();
  const intro = `Based on the saved knowledge base and the unchanged ML prediction of ${context.disease} (${context.confidence}% confidence):`;
  const uncertainty = context.confidence < 70 ? "\n\nConfidence is not high, so confirm with a local agriculture expert before expensive treatment or chemical use." : "";
  const userDetails = extractUserDetails(q);

  if (!entry) {
    return `${intro}\n\nI do not have a reliable offline knowledge-base entry for this disease yet. I can still use the diagnosis cards: symptoms are ${context.symptoms} Cause: ${context.cause}. For treatment, follow the listed recommendations and consult a local extension officer for specific products.${uncertainty}`;
  }

  if (matches(q, ["confidence", "sure", "probability", "accurate", "wrong", "prediction"])) {
    return `${intro}\n\nI cannot change the classifier result. The visible alternatives are ${context.probabilities.map((item) => `${item.name} (${item.confidence}%)`).join(", ")}. If symptoms do not match the photo result, retake a sharper close-up and compare with expert field inspection.${uncertainty}`;
  }
  if (matches(q, ["symptom", "look", "identify", "sign", "confirm"])) {
    return `${intro}\n\nConfirmed KB symptoms: ${entry.symptoms.join(" ")}\n\nYour result card says: ${context.symptoms}${uncertainty}`;
  }
  if (matches(q, ["cause", "why", "rain", "weather", "humidity", "temperature", "wet", "dry"])) {
    const detail = userDetails ? `\n\nYou mentioned ${userDetails}. Treat that as user-reported context, not a confirmed diagnosis. ` : "\n\nTell me recent rainfall, humidity, and whether leaves stay wet overnight for more specific offline guidance. ";
    return `${intro}\n\nConfirmed cause/risk factors: ${entry.cause} Risk conditions: ${entry.conditions.join("; ")}.${detail}${uncertainty}`;
  }
  if (matches(q, ["water", "watering", "irrigation", "spray", "overhead", "drip"])) {
    return `${intro}\n\nWatering guidance: ${entry.watering.join(" ")}\n\nAvoid keeping leaves wet unless the KB specifically says water spray is part of pest removal. Share how often you water and whether you use drip or overhead irrigation for a more tailored offline answer.${uncertainty}`;
  }
  if (matches(q, ["organic", "natural", "neem", "home", "biological"])) {
    return `${intro}\n\nOrganic or lower-risk options from the offline KB: ${entry.organic.join(" ")}\n\nThese are support measures. For severe or fast-spreading disease, confirm locally before relying only on organic control.${uncertainty}`;
  }
  if (matches(q, ["chemical", "fungicide", "pesticide", "bactericide", "insecticide", "dose", "dosage", "how much"])) {
    return `${intro}\n\nChemical guidance must follow the product label and local agricultural rules. The KB only supports these general product categories: ${entry.chemical.join(" ")} I cannot safely invent dosage, spray interval beyond the label, or brand-specific instructions offline.${uncertainty}`;
  }
  if (matches(q, ["prevent", "avoid", "next season", "future", "rotation", "resistant"])) {
    return `${intro}\n\nPrevention steps: ${entry.prevention.join(" ")}${uncertainty}`;
  }
  if (matches(q, ["spread", "contagious", "nearby", "other plants", "remove", "destroy"])) {
    return `${intro}\n\nSpread and sanitation guidance: ${entry.spread.join(" ")}${uncertainty}`;
  }
  if (matches(q, ["monitor", "check", "watch", "when", "again", "recover"])) {
    return `${intro}\n\nMonitoring advice: ${entry.monitoring.join(" ")}\n\nIf symptoms expand quickly, fruit/stems are affected, or plants collapse, get local expert help quickly.${uncertainty}`;
  }
  if (matches(q, ["stage", "flower", "fruit", "seedling", "growth", "soil", "fertilizer", "condition"])) {
    return `${intro}\n\nI need one more detail offline: plant growth stage, recent rainfall/watering, whether the disease is on lower or new leaves, and whether fruit/stems are affected. With those details I can match your situation to treatment, prevention, watering, or spread guidance without changing the ML prediction.${uncertainty}`;
  }

  return `${intro}\n\nOffline I can answer best about symptoms, cause, treatment, organic options, prevention, watering, spread, and monitoring for the predicted disease. Your question may need local expert judgment or online AI. Ask one of those topics, or add rainfall, watering method, growth stage, and what part of the plant is affected.${uncertainty}`;
}

function findKnowledgeEntry(label, diseaseName) {
  if (!state.assistantKb || !state.assistantKb.diseases) return null;
  return state.assistantKb.diseases[label] || Object.values(state.assistantKb.diseases).find((entry) => entry.common_name === diseaseName) || null;
}

function matches(text, words) {
  return words.some((word) => text.includes(word));
}

function extractUserDetails(text) {
  const details = [];
  if (matches(text, ["rain", "rainfall", "wet"])) details.push("rain or wet conditions");
  if (matches(text, ["overwater", "watering", "drip", "irrigation"])) details.push("watering practices");
  if (matches(text, ["flower", "fruit", "seedling", "stage"])) details.push("growth stage");
  if (matches(text, ["greenhouse", "field", "pot", "soil"])) details.push("growing conditions");
  return details.join(", ");
}

function shareReport() {
  if (!state.latestResult) return;
  const info = localizedInfo(state.latestResult.info);
  const lines = ["Plant Doctor", t("diagnosisTitle") + ": " + localizedName(state.latestResult.info.common_name), t("crop") + ": " + localizedName(state.latestResult.info.crop), t("modelConfidence") + ": " + state.latestResult.confidence + "%", t("causeLabel") + ": " + info.cause, t("remediesTitle") + ":"];
  info.remedies.forEach((item, index) => lines.push((index + 1) + ". " + item));
  const report = lines.join("\n");
  if (window.AndroidBridge) AndroidBridge.shareReport(report);
  else if (navigator.share) navigator.share({ text: report });
  else navigator.clipboard.writeText(report);
}

function showOverlay(step) { els.overlay.hidden = false; setAnalysisStep(step); }
function hideOverlay() { els.overlay.hidden = true; }
function setAnalysisStep(step) { els.step.textContent = step; }
function nextFrame() { return new Promise((resolve) => requestAnimationFrame(() => resolve())); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function mean(values) { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0; }
function std(values) { const m = mean(values); return values.length ? Math.sqrt(values.reduce((s, v) => s + (v - m) * (v - m), 0) / values.length) : 0; }
function round1(value) { return Math.round(value * 10) / 10; }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c])); }
