document.addEventListener('DOMContentLoaded', () => {
  // Sort state: { column: string, direction: 'asc'|'desc'|null }
  let sortState = { column: null, direction: null };
  
  // All fetched records for re-sorting
  let allFetchedRecords = [];
  
  // Initialize saved stocks from localStorage
  let savedStocks = JSON.parse(localStorage.getItem('savedStocks') || '[]');
  
  // Restore token if saved
  const saved = localStorage.getItem('apiToken');
  if (saved) document.getElementById('apiToken').value = saved;

  // Number formatting function
  const formatNumber = (num) => {
    if (typeof num !== 'number') return num;
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Calculate DTE from expiration date string
  const calculateDTE = (expirationStr) => {
    const expDate = new Date(expirationStr + 'T00:00:00Z');
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const diffTime = expDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Initialize dual range sliders
  function initializeRangeSliders() {
    // Initialize Strike-% slider
    initializeRangeSlider('strike', {
      min: 0,
      max: 100,
      startMin: 30,
      startMax: 80,
      suffix: '%',
      minInputId: 'minStrike',
      maxInputId: 'maxStrike'
    });
    
    // Initialize DTE slider
    initializeRangeSlider('dte', {
      min: 1,
      max: 365,
      startMin: 1,
      startMax: 45,
      suffix: ' days',
      minInputId: 'minDte',
      maxInputId: 'maxDte'
    });
  }

  // Generic range slider initialization
  function initializeRangeSlider(sliderName, options) {
    const rangeSlider = document.querySelector(`[data-slider="${sliderName}"]`);
    const rangeTrack = rangeSlider.querySelector('.range-track');
    const rangeSelected = rangeSlider.querySelector('.range-selected');
    const minThumb = rangeSlider.querySelector('.thumb-min');
    const maxThumb = rangeSlider.querySelector('.thumb-max');
    const minValue = document.getElementById(options.minInputId);
    const maxValue = document.getElementById(options.maxInputId);
    const display = rangeSlider.querySelector('.range-display');
    
    let minVal = options.startMin;
    let maxVal = options.startMax;
    
    function updateSlider() {
      const percent1 = ((minVal - options.min) / (options.max - options.min)) * 100;
      const percent2 = ((maxVal - options.min) / (options.max - options.min)) * 100;
      
      rangeSelected.style.left = percent1 + '%';
      rangeSelected.style.width = (percent2 - percent1) + '%';
      
      minThumb.style.left = percent1 + '%';
      maxThumb.style.left = percent2 + '%';
      
      minValue.value = minVal;
      maxValue.value = maxVal;
      
      const displayText = sliderName === 'dte' 
        ? `${minVal} - ${maxVal}${options.suffix}`
        : `${minVal}${options.suffix} - ${maxVal}${options.suffix}`;
      display.textContent = displayText;
    }
    
    function handleMinThumb(e) {
      e.preventDefault();
      const startX = e.clientX || e.touches[0].clientX;
      const startVal = minVal;
      const rect = rangeTrack.getBoundingClientRect();
      
      function onMove(e) {
        const currentX = e.clientX || e.touches[0].clientX;
        const diff = currentX - startX;
        const percent = (diff / rect.width) * 100;
        const range = options.max - options.min;
        let newVal = Math.round(startVal + (percent * range / 100));
        
        newVal = Math.max(options.min, Math.min(newVal, maxVal - 1));
        minVal = newVal;
        updateSlider();
      }
      
      function onEnd() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onEnd);
      }
      
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onEnd);
      document.addEventListener('touchmove', onMove);
      document.addEventListener('touchend', onEnd);
    }
    
    function handleMaxThumb(e) {
      e.preventDefault();
      const startX = e.clientX || e.touches[0].clientX;
      const startVal = maxVal;
      const rect = rangeTrack.getBoundingClientRect();
      
      function onMove(e) {
        const currentX = e.clientX || e.touches[0].clientX;
        const diff = currentX - startX;
        const percent = (diff / rect.width) * 100;
        const range = options.max - options.min;
        let newVal = Math.round(startVal + (percent * range / 100));
        
        newVal = Math.max(minVal + 1, Math.min(newVal, options.max));
        maxVal = newVal;
        updateSlider();
      }
      
      function onEnd() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onEnd);
      }
      
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onEnd);
      document.addEventListener('touchmove', onMove);
      document.addEventListener('touchend', onEnd);
    }
    
    minThumb.addEventListener('mousedown', handleMinThumb);
    minThumb.addEventListener('touchstart', handleMinThumb);
    maxThumb.addEventListener('mousedown', handleMaxThumb);
    maxThumb.addEventListener('touchstart', handleMaxThumb);
    
    // Click on track to move nearest thumb
    rangeTrack.addEventListener('click', (e) => {
      if (e.target.classList.contains('thumb')) return;
      
      const rect = rangeTrack.getBoundingClientRect();
      const percent = ((e.clientX - rect.left) / rect.width) * 100;
      const range = options.max - options.min;
      const value = options.min + (percent * range / 100);
      
      const distToMin = Math.abs(value - minVal);
      const distToMax = Math.abs(value - maxVal);
      
      if (distToMin < distToMax) {
        minVal = Math.round(Math.max(options.min, Math.min(value, maxVal - 1)));
      } else {
        maxVal = Math.round(Math.max(minVal + 1, Math.min(value, options.max)));
      }
      
      updateSlider();
    });
    
    updateSlider();
  }

  // Create stock input section
  function createStockInputSection() {
    const container = document.getElementById('tradeForm');
    const stockSection = document.createElement('div');
    stockSection.className = 'stock-input-section';
    stockSection.innerHTML = `
      <div class="manual-stocks">
        <h3>Enter Stocks</h3>
        <div id="stockInputs">
          <div class="stock-input-row">
            <input type="text" class="stock-input" maxlength="7" placeholder="e.g., AAPL">
            <label class="save-label" style="display: none;"><input type="checkbox" class="save-stock-cb"> Save</label>
          </div>
        </div>
        <button type="button" id="addStockBtn" class="add-stock-btn">+ Add More</button>
      </div>
      
      <div class="saved-stocks-section">
        <h3>Saved Stocks</h3>
        <div id="savedStocks" class="stock-checkboxes"></div>
      </div>
    `;
    
    // Insert after API token field
    const apiGroup = container.querySelector('.form-group');
    apiGroup.after(stockSection);
    
    // Remove old symbol input
    const oldSymbolGroup = container.querySelector('label:has(#symbol)').parentElement;
    oldSymbolGroup.remove();
    
    // Initial render of saved stocks
    renderSavedStocks();
    
    // Add stock button handler
    document.getElementById('addStockBtn').addEventListener('click', addStockInput);
    
    // Add input handler for first input
    const firstInput = container.querySelector('.stock-input');
    firstInput.addEventListener('input', handleStockInputChange);
  }

  // Handle input change to show/hide save button
  function handleStockInputChange(e) {
    const saveLabel = e.target.parentElement.querySelector('.save-label');
    if (e.target.value.trim()) {
      saveLabel.style.display = 'inline-flex';
    } else {
      saveLabel.style.display = 'none';
      // Uncheck if input is cleared
      const checkbox = saveLabel.querySelector('.save-stock-cb');
      if (checkbox) checkbox.checked = false;
    }
  }

  // Add new stock input row
  function addStockInput() {
    const container = document.getElementById('stockInputs');
    const row = document.createElement('div');
    row.className = 'stock-input-row';
    row.innerHTML = `
      <input type="text" class="stock-input" maxlength="7" placeholder="e.g., AAPL">
      <label class="save-label" style="display: none;"><input type="checkbox" class="save-stock-cb"> Save</label>
      <button type="button" class="remove-input-btn">×</button>
    `;
    container.appendChild(row);
    
    // Add input handler
    const input = row.querySelector('.stock-input');
    input.addEventListener('input', handleStockInputChange);
    
    // Remove button handler
    row.querySelector('.remove-input-btn').addEventListener('click', () => {
      row.remove();
    });
  }

  // Render saved stocks with remove buttons
  function renderSavedStocks() {
    const savedDiv = document.getElementById('savedStocks');
    savedDiv.innerHTML = '';
    
    if (savedStocks.length === 0) {
      savedDiv.innerHTML = '<span class="no-saved">No saved stocks yet. Enter a stock symbol and check "Save" to add it here.</span>';
      return;
    }
    
    savedStocks.forEach(stock => {
      const wrapper = document.createElement('div');
      wrapper.className = 'saved-stock-wrapper';
      wrapper.innerHTML = `
        <label class="stock-checkbox">
          <input type="checkbox" value="${stock}"> ${stock}
        </label>
        <button type="button" class="remove-saved-btn" data-stock="${stock}">×</button>
      `;
      savedDiv.appendChild(wrapper);
    });
    
    // Add remove handlers
    savedDiv.querySelectorAll('.remove-saved-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const stock = e.target.dataset.stock;
        savedStocks = savedStocks.filter(s => s !== stock);
        localStorage.setItem('savedStocks', JSON.stringify(savedStocks));
        renderSavedStocks();
      });
    });
  }

  // Get all selected stocks
  function getSelectedStocks() {
    const stocks = new Set();
    
    // Manual inputs
    document.querySelectorAll('.stock-input').forEach((input, idx) => {
      const value = input.value.trim().toUpperCase();
      if (value) {
        stocks.add(value);
        
        // Check if should save
        const saveCheckbox = input.parentElement.querySelector('.save-stock-cb');
        if (saveCheckbox?.checked && !savedStocks.includes(value)) {
          savedStocks.push(value);
          localStorage.setItem('savedStocks', JSON.stringify(savedStocks));
        }
      }
    });
    
    // Checked saved stocks
    document.querySelectorAll('#savedStocks input:checked').forEach(cb => {
      stocks.add(cb.value);
    });
    
    return Array.from(stocks);
  }

  // Sort function
  function sortRecords(records, column, direction) {
    const sorted = [...records];
    
    sorted.sort((a, b) => {
      let aVal = a[column];
      let bVal = b[column];
      
      // Handle special cases
      if (column === 'symbol' || column === 'expDate') {
        aVal = aVal.toString();
        bVal = bVal.toString();
      } else if (typeof aVal === 'string' && aVal.includes('%')) {
        aVal = parseFloat(aVal);
        bVal = parseFloat(bVal);
      }
      
      let primary = 0;
      if (aVal < bVal) primary = -1;
      else if (aVal > bVal) primary = 1;
      
      if (direction === 'desc') primary *= -1;
      
      // Secondary sort by annPctCall (always descending)
      if (primary === 0 && column !== 'annPctCall') {
        return b.annPctCall - a.annPctCall;
      }
      
      return primary;
    });
    
    return sorted;
  }

  // Create sortable table header
  function createTableHeader(isSingleSymbol = false) {
    const headers = [
      { key: 'symbol', label: 'Symbol', skip: isSingleSymbol },
      { key: 'price', label: 'Price', skip: isSingleSymbol },
      { key: 'expDate', label: 'Expire Date' },
      { key: 'dte', label: 'DTE' },
      { key: 'strike', label: 'Strike' },
      { key: 'priceStrikePct', label: 'Price-Strike %' },
      { key: 'bid', label: 'Bid' },
      { key: 'ask', label: 'Ask' },
      { key: 'mid', label: 'Mid' },
      { key: 'cost', label: 'Cost' },      
      { key: 'maxProfit', label: 'Max Profit' },
      { key: 'pctCall', label: '% Call' },
      { key: 'annPctCall', label: 'Ann. % Call' }
    ];
    
    const thead = document.createElement('thead');
    const tr = document.createElement('tr');
    
    headers.forEach(({ key, label, skip }) => {
      if (skip) return;
      
      const th = document.createElement('th');
      th.className = 'sortable';
      th.dataset.column = key;
      th.innerHTML = `${label} <span class="sort-arrow"></span>`;
      
      th.addEventListener('click', () => handleSort(key));
      
      // Update arrow display
      if (sortState.column === key) {
        th.classList.add('sorted');
        const arrow = th.querySelector('.sort-arrow');
        arrow.textContent = sortState.direction === 'asc' ? '▲' : '▼';
      }
      
      tr.appendChild(th);
    });
    
    thead.appendChild(tr);
    return thead;
  }

  // Handle column sort
  function handleSort(column) {
    if (sortState.column === column) {
      // Cycle through: asc -> desc -> null
      if (sortState.direction === 'asc') {
        sortState.direction = 'desc';
      } else if (sortState.direction === 'desc') {
        sortState.column = null;
        sortState.direction = null;
      }
    } else {
      sortState.column = column;
      sortState.direction = 'asc';
    }
    
    // Re-render table with new sort
    renderResults();
  }

  // Render results table
  function renderResults() {
    const container = document.getElementById('resultsContainer');
    
    let displayRows = [...allFetchedRecords];
    
    // Apply sort
    if (sortState.column) {
      displayRows = sortRecords(displayRows, sortState.column, sortState.direction);
    } else {
      // Default sort by annPctCall descending
      displayRows.sort((a, b) => b.annPctCall - a.annPctCall);
    }
    
    // Clear and rebuild
    container.innerHTML = '';
    
    // Check if single symbol
    const uniqueSymbols = [...new Set(displayRows.map(r => r.symbol))];
    const isSingleSymbol = uniqueSymbols.length === 1;
    
    if (isSingleSymbol) {
      // Display symbol and price info above table
      const stockInfo = document.createElement('div');
      stockInfo.className = 'stock-info';
      stockInfo.innerHTML = `
        <h2>${uniqueSymbols[0]}</h2>
        <p class="stock-price">Current Price: $${formatNumber(displayRows[0].price)}</p>
      `;
      container.appendChild(stockInfo);
    }
    
    const summary = document.createElement('p');
    summary.textContent = `Showing all ${displayRows.length} eligible call options.`;
    container.appendChild(summary);
    
    const table = document.createElement('table');
    table.className = 'result-table';
    table.appendChild(createTableHeader(isSingleSymbol));
    
    const tbody = document.createElement('tbody');
    displayRows.forEach(r => {
      const row = document.createElement('tr');
      const cells = [];
      
      if (!isSingleSymbol) {
        cells.push(`<td>${r.symbol}</td>`);
        cells.push(`<td>${formatNumber(r.price)}</td>`);
      }
      
      cells.push(
        `<td>${r.expDate}</td>`,
        `<td>${r.dte}</td>`,
        `<td>${formatNumber(r.strike)}</td>`,
        `<td>${r.priceStrikePct.toFixed(2)}%</td>`,
        `<td>${formatNumber(r.bid)}</td>`,
        `<td>${formatNumber(r.ask)}</td>`,
        `<td>${formatNumber(r.mid)}</td>`,
        `<td>${formatNumber(r.cost)}</td>`,        
        `<td>${formatNumber(r.maxProfit)}</td>`,
        `<td>${r.pctCall.toFixed(2)}%</td>`,
        `<td>${formatNumber(r.annPctCall)}%</td>`
      );
      
      row.innerHTML = cells.join('');
      tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    container.appendChild(table);
  }

  // Initialize stock input section
  createStockInputSection();
  
  // Initialize range sliders
  setTimeout(initializeRangeSliders, 100);

  // Main form submission - OPTIMIZED VERSION
  document.getElementById('tradeForm').addEventListener('submit', async e => {
    e.preventDefault();

    let apiCalls = 0;
    const apiToken = document.getElementById('apiToken').value.trim();
    const minStrikePct = parseInt(document.getElementById('minStrike').value);
    const maxStrikePct = parseInt(document.getElementById('maxStrike').value);
    const minDte = parseInt(document.getElementById('minDte').value) || 1;
    const maxDte = parseInt(document.getElementById('maxDte').value) || 365;
    const msg = document.getElementById('message');
    const container = document.getElementById('resultsContainer');

    localStorage.setItem('apiToken', apiToken);
    
    // Get selected stocks
    const stocks = getSelectedStocks();
    if (stocks.length === 0) {
      msg.textContent = 'Please select at least one stock.';
      return;
    }
    
    msg.textContent = `Loading data for ${stocks.length} stock(s)...`;
    container.innerHTML = '';
    
    // Reset sort state
    sortState = { column: null, direction: null };
    allFetchedRecords = [];

    try {
      // Process each stock
      for (const symbol of stocks) {
        // Get expirations
        apiCalls++;
        const expRes = await fetch(
          `https://api.marketdata.app/v1/options/expirations/${symbol}`,
          { headers: { Authorization: `Bearer ${apiToken}` } }
        );
        const expJson = await expRes.json();
        const allExpirations = expJson.expirations || [];

        if (!allExpirations.length) continue;

        // Filter expirations by DTE range
        const filteredExpirations = allExpirations.filter(expStr => {
          const dte = calculateDTE(expStr);
          return dte >= minDte && dte <= maxDte;
        });

        if (!filteredExpirations.length) continue;

        // OPTIMIZATION: Get first expiration to fetch underlying price
        apiCalls++;
        const firstChainRes = await fetch(
          `https://api.marketdata.app/v1/options/chain/${symbol}/?expiration=${filteredExpirations[0]}&side=call`,
          { headers: { Authorization: `Bearer ${apiToken}` } }
        );
        const firstData = await firstChainRes.json();
        if (firstData.s !== 'ok' || !firstData.underlyingPrice?.length) continue;

        const price = firstData.underlyingPrice[0];
        const minStrike = Math.floor(price * (minStrikePct / 100));
        const maxStrike = Math.floor(price * (maxStrikePct / 100));

        // Now fetch all expirations with strike filter
        for (const expStr of filteredExpirations) {
          apiCalls++;
          const chainRes = await fetch(
            `https://api.marketdata.app/v1/options/chain/${symbol}/?expiration=${expStr}&side=call&strike=${minStrike}-${maxStrike}`,
            { headers: { Authorization: `Bearer ${apiToken}` } }
          );
          const data = await chainRes.json();
          if (data.s !== 'ok' || !data.optionSymbol?.length) continue;

          // Process all returned options (already filtered by API)
          for (let i = 0; i < data.optionSymbol.length; i++) {
            const strike = data.strike[i];
            const mid = data.mid[i];
            const bid = data.bid[i];
            const ask = data.ask[i];
            const dte = data.dte[i];
            const exp = data.expiration[i];

            // Double-check DTE is within range (in case API returns unexpected values)
            if (dte < minDte || dte > maxDte) continue;

            const cost = (price - mid) * 100;            
            const maxProfit = (strike * 100) - cost;
            const pctCall = (maxProfit / cost) * 100;
            const annPctCall = (pctCall * 365) / dte;
            const priceStrikePct = ((price - strike) / price) * 100;

            allFetchedRecords.push({
              symbol,
              price,
              exp,
              expDate: new Date(exp * 1000).toLocaleDateString('en-GB'),
              dte,
              strike,
              bid,
              ask,
              mid,
              cost,              
              maxProfit,
              pctCall,
              annPctCall,
              priceStrikePct
            });
          }
        }
      }

      if (!allFetchedRecords.length) {
        msg.textContent = 'No valid call options found after filtering.';
        return;
      }

      msg.textContent = `Found ${allFetchedRecords.length} options. API calls: ${apiCalls}`;
      
      // Update saved stocks display
      renderSavedStocks();
      
      // Render results
      renderResults();

    } catch (err) {
      console.error(err);
      msg.textContent = `Error: ${err.message}. Check your API token and try again.`;
    }
  });
});