// 中文背標批量圖片生成器 - 主邏輯 app.js

document.addEventListener('DOMContentLoaded', () => {
  // DOM 元素引用
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const fileInfo = document.getElementById('fileInfo');
  const btnDownloadTemplate = document.getElementById('btnDownloadTemplate');
  const actionSection = document.getElementById('actionSection');
  const totalCountEl = document.getElementById('totalCount');
  const btnGenerateZip = document.getElementById('btnGenerateZip');
  const btnPrintAll = document.getElementById('btnPrintAll');
  const progressContainer = document.getElementById('progressContainer');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  const progressPercent = document.getElementById('progressPercent');
  const previewSection = document.getElementById('previewSection');
  const cardsGrid = document.getElementById('cardsGrid');

  // 設定輸入框
  const labelPreset = document.getElementById('labelPreset');
  const inputWidth = document.getElementById('labelWidth');
  const inputHeight = document.getElementById('labelHeight');
  const inputFontSize = document.getElementById('baseFontSize');
  const selectDpi = document.getElementById('dpiSelect');

  // Modal 元素
  const modalOverlay = document.getElementById('modalOverlay');
  const modalClose = document.getElementById('modalClose');
  const modalContent = document.getElementById('modalContent');
  const btnDownloadSingle = document.getElementById('btnDownloadSingle');

  // 狀態紀錄
  let parsedItems = [];
  let generatedCanvases = [];
  let currentActiveIndex = 0;

  // 預設選單切換事件
  labelPreset.addEventListener('change', () => {
    const val = labelPreset.value;
    if (val !== 'custom') {
      const [w, h] = val.split('x');
      inputWidth.value = w;
      inputHeight.value = h;
      if (parsedItems.length > 0) renderAllLabels();
    }
  });

  inputWidth.addEventListener('input', () => { labelPreset.value = 'custom'; });
  inputHeight.addEventListener('input', () => { labelPreset.value = 'custom'; });

  // 欄位標準定義與別名映射
  const FIELD_DEFINITIONS = [
    { key: 'product_name', label: '產品名稱:', side: 'left', aliases: ['產品名稱', '品名', '商品名稱', '產品名稱:'] },
    { key: 'color', label: '顏色:', side: 'left', aliases: ['顏色', '顏色:'] },
    { key: 'spec', label: '規格:', side: 'left', aliases: ['規格', '規格:'] },
    { key: 'size', label: '尺寸:', side: 'left', aliases: ['尺寸', '尺寸:'] },
    { key: 'net_weight', label: '淨重:', side: 'left', aliases: ['淨重', '重量', '淨重:'] },
    { key: 'material', label: '材質:', side: 'left', aliases: ['材質', '成分', '材質:'] },
    { key: 'quantity', label: '件數:', side: 'left', aliases: ['件數', '數量', '包裝數量', '件數:'] },
    { key: 'origin', label: '原產地:', side: 'left', aliases: ['原產地', '產地', '製造地', '原產地:'] },
    { key: 'mfg_date', label: '製造日期:', side: 'left', aliases: ['製造日期', '生產日期', '製造日期:'] },
    { key: 'exp_date', label: '有效期限:', side: 'left', aliases: ['有效期限', '保存期限', '有效期', '有效期限:'] },
    { key: 'storage', label: '保存方式:', side: 'left', aliases: ['保存方式', '儲存方式', '保存方式:'] },
    { key: 'pet_type', label: '適用寵物種類:', side: 'left', aliases: ['適用寵物種類', '適用寵物', '適用對象', '適用寵物種類:'] },

    { key: 'usage_purpose', label: '用途:', side: 'right', aliases: ['用途', '產品用途', '用途:'] },
    { key: 'usage_method', label: '使用方法:', side: 'right', aliases: ['使用方法', '用法', '使用說明', '使用方法:'] },
    { key: 'precautions', label: '注意事項:', side: 'right', aliases: ['注意事項', '注意事宜', '警語', '注意事項:'] },
    { key: 'mfr_name', label: '製造商:', side: 'right', aliases: ['製造商', '生產商', '製造商:'] },
    { key: 'mfr_address', label: '地址:', side: 'right', aliases: ['製造商地址', '製造地址', '製造商工廠地址', '製造商 地址'] },
    { key: 'mfr_phone', label: '電話:', side: 'right', aliases: ['製造商電話', '製造電話', '製造商 電話'] },
    { key: 'importer_name', label: '進口商:', side: 'right', aliases: ['進口商', '代理商', '進口商:'] },
    { key: 'importer_address', label: '地址:', side: 'right', aliases: ['進口商地址', '進口地址', '公司地址', '進口商 地址'] },
    { key: 'importer_phone', label: '電話:', side: 'right', aliases: ['進口商電話', '進口電話', '客服電話', '進口商 電話'] }
  ];

  // 1. 拖曳與選擇檔案
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  });
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  });

  // 設定選項改變時自動重繪
  [inputWidth, inputHeight, inputFontSize, selectDpi].forEach(elem => {
    elem.addEventListener('change', () => {
      if (parsedItems.length > 0) renderAllLabels();
    });
  });

  btnDownloadTemplate.addEventListener('click', generateStandardExcelTemplate);

  // 2. 讀取 Excel
  function handleFileSelect(file) {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      alert('請上傳 .xlsx 或 .xls 格式的 Excel 檔案！');
      return;
    }

    fileInfo.textContent = `已選擇檔案：${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    fileInfo.classList.remove('hidden');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        
        if (jsonData.length === 0) {
          alert('Excel 檔案內未發現有效資料列！');
          return;
        }

        parseExcelData(jsonData);
      } catch (err) {
        console.error('Excel 解析失敗:', err);
        alert('讀取 Excel 檔案時發生錯誤，請確認檔案格式是否正確。');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // 3. 解析與對應
  function parseExcelData(rows) {
    parsedItems = rows.map((row, idx) => {
      const itemData = {};
      
      FIELD_DEFINITIONS.forEach(def => {
        let value = '';
        
        for (const keyInRow of Object.keys(row)) {
          const cleanKey = keyInRow.trim().replace(/:/g, '');
          const match = def.aliases.some(alias => {
            const cleanAlias = alias.trim().replace(/:/g, '');
            return cleanKey.toLowerCase() === cleanAlias.toLowerCase();
          });

          if (match) {
            value = row[keyInRow];
            break;
          }
        }

        // 日期轉為 D/M/YYYY (例如 15/3/2026) 格式以匹配目標樣本樣式
        if (value instanceof Date) {
          const y = value.getFullYear();
          const m = value.getMonth() + 1;
          const d = value.getDate();
          value = `${d}/${m}/${y}`;
        } else if (value !== null && value !== undefined) {
          value = String(value).trim();
          // 若為 YYYY-MM-DD 格式，也轉為 D/M/YYYY
          if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(value)) {
            const parts = value.split('-');
            value = `${parseInt(parts[2], 10)}/${parseInt(parts[1], 10)}/${parts[0]}`;
          }
        } else {
          value = '';
        }

        itemData[def.key] = value;
      });

      itemData._rawRowIndex = idx + 1;
      return itemData;
    });

    totalCountEl.textContent = parsedItems.length;
    actionSection.classList.remove('hidden');
    previewSection.classList.remove('hidden');

    renderAllLabels();
  }

  // 4. 渲染所有背標
  function renderAllLabels() {
    cardsGrid.innerHTML = '';
    generatedCanvases = [];

    const widthMm = parseFloat(inputWidth.value) || 80;
    const heightMm = parseFloat(inputHeight.value) || 60;
    const baseFontSizePt = parseFloat(inputFontSize.value) || 10;
    const dpi = parseInt(selectDpi.value, 10) || 300;

    parsedItems.forEach((item, index) => {
      const canvas = renderLabelToCanvas(item, widthMm, heightMm, baseFontSizePt, dpi);
      generatedCanvases.push({ canvas, item, index });

      const card = document.createElement('div');
      card.className = 'label-card';
      
      const productName = item.product_name || `商品 #${index + 1}`;
      const specName = item.spec ? ` (${item.spec})` : '';

      card.innerHTML = `
        <div class="card-header">
          <span class="card-title" title="${productName}${specName}">#${index + 1} ${productName}${specName}</span>
          <span class="card-badge">${widthMm}x${heightMm}mm</span>
        </div>
        <div class="card-canvas-wrapper"></div>
        <div class="card-actions">
          <button class="btn btn-secondary btn-preview-single" data-index="${index}">放大預覽</button>
          <button class="btn btn-primary btn-download-single" data-index="${index}">下載 PNG</button>
        </div>
      `;

      card.querySelector('.card-canvas-wrapper').appendChild(canvas);

      card.querySelector('.btn-preview-single').addEventListener('click', () => openModal(index));
      card.querySelector('.btn-download-single').addEventListener('click', () => downloadSingleCanvas(index));

      cardsGrid.appendChild(card);
    });
  }

  // 5. 無邊框、純文字雙欄對齊背標渲染演算法 (寬版橫向對齊模式)
  function renderLabelToCanvas(item, widthMm, heightMm, baseFontSizePt, dpi) {
    const mmToInch = 1 / 25.4;
    const canvasWidth = Math.round(widthMm * mmToInch * dpi);
    const canvasHeight = Math.round(heightMm * mmToInch * dpi);

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const ctx = canvas.getContext('2d');

    // 純白背景 (無黑外框、無中界線)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 邊距 (2.5% 邊距)
    const padX = Math.round(canvasWidth * 0.025);
    const padY = Math.round(canvasHeight * 0.03);
    const availableW = canvasWidth - padX * 2;
    const availableH = canvasHeight - padY * 2;

    // 左右欄位 X 起始座標 (左欄 0%, 右欄 42% 起始，提供右欄極為寬裕的橫向空間)
    const leftX = padX;
    const rightX = padX + Math.round(availableW * 0.42);

    const leftMaxW = (rightX - padX * 0.3) - leftX;
    const rightMaxW = (padX + availableW) - rightX;

    const leftFields = FIELD_DEFINITIONS.filter(f => f.side === 'left');
    const rightFields = FIELD_DEFINITIONS.filter(f => f.side === 'right');

    // 動態防溢出字型等級計算
    let fontSizePx = baseFontSizePt * (dpi / 72);
    let lineSpacingRatio = 1.32;
    let isFit = false;

    let leftBlocks = [];
    let rightBlocks = [];
    let lineStep = 0;
    let valueIndentLeft = 0;
    let valueIndentRight = 0;

    const fontStack = '-apple-system, BlinkMacSystemFont, "Noto Sans TC", "Microsoft JhengHei", sans-serif';

    while (!isFit && fontSizePx >= 5 * (dpi / 72)) {
      ctx.font = `${Math.round(fontSizePx)}px ${fontStack}`;
      lineStep = fontSizePx * lineSpacingRatio;

      // 欄位標籤固定寬度 (對齊左欄與右欄的值)
      valueIndentLeft = ctx.measureText('產品名稱: ').width;
      valueIndentRight = ctx.measureText('注意事項: ').width;

      leftBlocks = layoutColumnWithIndent(ctx, leftFields, item, leftX, valueIndentLeft, leftMaxW);
      rightBlocks = layoutColumnWithIndent(ctx, rightFields, item, rightX, valueIndentRight, rightMaxW);

      const totalLeftH = leftBlocks.reduce((sum, b) => sum + b.lines.length * lineStep, 0);
      const totalRightH = rightBlocks.reduce((sum, b) => sum + b.lines.length * lineStep, 0);
      const maxH = Math.max(totalLeftH, totalRightH);

      if (maxH <= availableH) {
        isFit = true;
      } else {
        fontSizePx *= 0.96; // 縮小 4%
      }
    }

    // 開始繪製文字
    ctx.fillStyle = '#000000';
    ctx.textBaseline = 'top';
    ctx.font = `${Math.round(fontSizePx)}px ${fontStack}`;

    // 繪製左欄
    let currentY = padY;
    leftBlocks.forEach(block => {
      block.lines.forEach((lineText, lineIdx) => {
        const drawX = (lineIdx === 0) ? block.startX : block.indentX;
        ctx.fillText(lineText, drawX, currentY);
        currentY += lineStep;
      });
    });

    // 繪製右欄
    currentY = padY;
    rightBlocks.forEach(block => {
      block.lines.forEach((lineText, lineIdx) => {
        const drawX = (lineIdx === 0) ? block.startX : block.indentX;
        ctx.fillText(lineText, drawX, currentY);
        currentY += lineStep;
      });
    });

    return canvas;
  }

  // 專用對齊換行演算法 (完美複製圖片中的 Key / Value 對齊與縮排)
  function layoutColumnWithIndent(ctx, fields, item, colStartX, valueIndentW, columnMaxW) {
    const blocks = [];

    fields.forEach(f => {
      const val = item[f.key] || '';
      const labelStr = f.label;
      const labelW = ctx.measureText(labelStr).width;
      const spaceW = ctx.measureText(' ').width;

      const indentX = colStartX + valueIndentW;
      const firstLineValMaxW = columnMaxW - labelW;
      const secondLineValMaxW = columnMaxW - valueIndentW;

      // 折行計算
      const valLines = wrapValueText(ctx, val, firstLineValMaxW, secondLineValMaxW);

      const fieldLines = [];
      if (valLines.length === 0) {
        fieldLines.push(labelStr);
      } else {
        // 第一行: Key + Value 第一段
        fieldLines.push(labelStr + ' ' + valLines[0]);
        // 後續行: 僅 Value 段 (X 座標由 indentX 提供)
        for (let i = 1; i < valLines.length; i++) {
          fieldLines.push(valLines[i]);
        }
      }

      blocks.push({
        lines: fieldLines,
        startX: colStartX,
        indentX: indentX
      });
    });

    return blocks;
  }

  // 輔助 Value 換行演算法
  function wrapValueText(ctx, text, firstLineMaxW, subLineMaxW) {
    if (!text) return [''];

    const lines = [];
    const chars = Array.from(text);
    let currentLine = '';
    let currentMaxW = firstLineMaxW;

    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      const testLine = currentLine + char;
      const w = ctx.measureText(testLine).width;

      if (w > currentMaxW && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = char;
        currentMaxW = subLineMaxW; // 切換為第二行以後的對齊寬度
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
    return lines;
  }

  // 6. 打包下載 ZIP 檔 (安全檔名修復，防止 Windows Defender 封鎖)
  btnGenerateZip.addEventListener('click', async () => {
    if (generatedCanvases.length === 0) return;

    progressContainer.classList.remove('hidden');
    progressBar.style.width = '0%';
    progressText.textContent = '正在打包圖片為 ZIP...';
    progressPercent.textContent = '0%';

    const zip = new JSZip();
    const folder = zip.folder('中文背標圖片');
    const namingFormatSelect = document.getElementById('namingFormat');
    const namingMode = namingFormatSelect ? namingFormatSelect.value : 'safe';

    const total = generatedCanvases.length;

    for (let i = 0; i < total; i++) {
      const { canvas, item } = generatedCanvases[i];
      let filename = '';

      if (namingMode === 'number') {
        filename = `label_${String(i + 1).padStart(3, '0')}.png`;
      } else {
        // 嚴格淨化檔名：替換所有空白、空格、特殊符號與全形半形標點為底線
        let cleanName = (item.product_name || `商品_${i + 1}`)
          .replace(/[\s\/\-\\?%*:|"<>()[\]{},.；：，。]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_+|_+$/g, '');

        if (cleanName.length > 25) {
          cleanName = cleanName.substring(0, 25);
        }

        let specStr = '';
        if (item.spec) {
          specStr = '_' + item.spec.replace(/[\s\/\-\\?%*:|"<>()[\]{},.；：，。]/g, '_').replace(/_+/g, '_');
          if (specStr.length > 10) specStr = specStr.substring(0, 10);
        }

        // 不再加上前綴數字編號，字尾加上 _背標
        filename = `${cleanName}${specStr}_背標.png`;
      }

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const arrayBuffer = await blob.arrayBuffer();
      
      // 寫入 ZIP 時明確設定 date 與二進位格式
      folder.file(filename, arrayBuffer, { binary: true, date: new Date() });

      const percent = Math.round(((i + 1) / total) * 100);
      progressBar.style.width = `${percent}%`;
      progressPercent.textContent = `${percent}%`;
      progressText.textContent = `已處理 (${i + 1}/${total})...`;

      await new Promise(r => setTimeout(r, 10));
    }

    progressText.textContent = '壓縮檔打包中，準備下載...';
    const zipBlob = await zip.generateAsync({ 
      type: 'blob',
      mimeType: 'application/zip',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
    saveAs(zipBlob, '中文背標圖片批量打包.zip');

    progressText.textContent = '完成打包下載！';
  });

  // 7. 一鍵列印
  btnPrintAll.addEventListener('click', () => {
    window.print();
  });

  // 8. 單張下載
  function downloadSingleCanvas(index) {
    if (!generatedCanvases[index]) return;
    const { canvas, item } = generatedCanvases[index];
    
    let safeName = (item.product_name || `背標_${index + 1}`).replace(/[\/\\?%*:|"<>]/g, '_');
    let specStr = item.spec ? `_${item.spec.replace(/[\/\\?%*:|"<>]/g, '_')}` : '';
    const filename = `${safeName}${specStr}_背標.png`;

    canvas.toBlob((blob) => {
      saveAs(blob, filename);
    }, 'image/png');
  }

  // 9. Modal
  function openModal(index) {
    if (!generatedCanvases[index]) return;
    currentActiveIndex = index;
    const { canvas } = generatedCanvases[index];

    modalContent.innerHTML = '';
    const cloneCanvas = document.createElement('canvas');
    cloneCanvas.width = canvas.width;
    cloneCanvas.height = canvas.height;
    const ctx = cloneCanvas.getContext('2d');
    ctx.drawImage(canvas, 0, 0);

    modalContent.appendChild(cloneCanvas);
    modalOverlay.classList.remove('hidden');
  }

  modalClose.addEventListener('click', () => modalOverlay.classList.add('hidden'));
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) modalOverlay.classList.add('hidden');
  });

  btnDownloadSingle.addEventListener('click', () => downloadSingleCanvas(currentActiveIndex));

  // 10. 動態生成標準 Excel 填寫範本 (包含表頭主題顏色與單一產品範例)
  function generateStandardExcelTemplate() {
    const headers = [
      '產品名稱', '顏色', '規格', '尺寸', '淨重', '材質', 
      '件數', '原產地', '製造日期', '有效期限', '保存方式', '適用寵物種類',
      '用途', '使用方法', '注意事項', '製造商', '製造商地址', 
      '製造商電話', '進口商', '進口商地址', '進口商電話'
    ];

    const sampleRow1 = [
      '芬蘭 Woolly Wolf Alpha 360 項圈',
      '陶土混色/',
      'L號',
      '背長28-32cm | 胸圍38-48cm | 頸圍25-35cm',
      '190G',
      '100%再生聚酯纖維(RPET)',
      1,
      '中國',
      '15/3/2026',
      '五年',
      '請置於陰涼乾燥處',
      '全齡犬',
      '寵物保暖穿著使用',
      '穿戴於寵物身上',
      '請放置於孩童與寵物不易取得處,產品中之小零件請勿放入口中,以免不慎誤食',
      'Woolly Wolf / The Black Fox Company Oy',
      'FINLAND  Mikkolantie 1A 00640 Helsinki',
      '+358 50 3375388',
      '緯豪實業股份有限公司',
      '新北市淡水區中正東路二段29-2號5樓',
      '02-2809-5266'
    ];

    // 僅保留 1 個產品範例
    const wsData = [headers, sampleRow1];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // 設定表頭 (第一列) 底色為 #EEECE1 (淡柔米黃色)
    headers.forEach((h, colIdx) => {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIdx });
      if (ws[cellRef]) {
        ws[cellRef].s = {
          fill: {
            patternType: "solid",
            fgColor: { rgb: "EEECE1" },
            bgColor: { rgb: "EEECE1" }
          },
          font: { name: "微軟正黑體", sz: 11, bold: true, color: { rgb: "000000" } },
          alignment: { horizontal: "center", vertical: "center" }
        };
      }
    });

    // 設定欄寬
    ws['!cols'] = headers.map(() => ({ wch: 24 }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '中文背標批量資料');

    // 匯出包含樣式 cellStyles 的 Excel 檔案
    XLSX.writeFile(wb, '中文背標批量填寫範本.xlsx', { cellStyles: true });
  }
});
