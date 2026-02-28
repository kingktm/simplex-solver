/**
 * Helper: Converts text like "X1" or "S2" to "X<sub>1</sub>" or "S<sub>2</sub>"
 */
function formatVar(str) {
    if (!str) return "";
    return str.replace(/(\d+)/g, '<sub>$1</sub>');
}

/**
 * Helper: Converts decimal to Fraction (e.g., 3.5 -> 7/2)
 */
function toFraction(decimal) {
    if (Math.abs(decimal) < 1e-10) return "0";
    if (Math.abs(decimal - Math.round(decimal)) < 1e-8) {
        return Math.round(decimal).toString();
    }

    const val = parseFloat(decimal.toFixed(8));
    const absVal = Math.abs(val);
    
    let h1 = 1, h2 = 0, k1 = 0, k2 = 1, b = absVal;
    do {
        let a = Math.floor(b + 1e-10);
        let aux = h1; h1 = a * h1 + h2; h2 = aux;
        aux = k1; k1 = a * k1 + k2; k2 = aux;
        if (Math.abs(b - a) < 1e-10) break;
        b = 1 / (b - a);
    } while (Math.abs(absVal - h1 / k1) > 1e-8 && k1 < 1000);

    let numerator = h1 * (val < 0 ? -1 : 1);
    let denominator = k1;

    return denominator === 1 ? `${numerator}` : `${numerator}/${denominator}`;
}

function toDecimal(val) {
    if (val === null || isNaN(val) || val === Infinity) return "-";
    if (Math.abs(val) < 1e-10) return "0";
    if (Math.abs(val - Math.round(val)) < 1e-8) return Math.round(val).toString();
    return parseFloat(val.toFixed(2)).toString();
}

function numberToRoman(num) {
    const roman =["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"];
    return roman[num] || num;
}

function renderIntroduction(type, activeVars, extraVars, rows) {
    let html = '<div class="introduction-box">';

    html += 'SOLUTION:\n\n';

    // ── Build base objective terms quietly (we need them for the modified form) ──
    let objTerms =[];
    activeVars.forEach(v => {
        let coef = v.cost;
        if (coef !== 0) {
            let sign = coef > 0 ? ' +' : ' -';
            let absCoef = Math.abs(coef);
            let coefStr = absCoef === 1 ? '' : absCoef;
            objTerms.push(`${sign} ${coefStr}${formatVar(v.label)}`);
        }
    });

    // ── Detect variable types ────────────────────────────────────────────
    const hasSlack = extraVars.some(v => v.type === 'S' && v.coeff === 1);
    const hasSurplus = extraVars.some(v => v.type === 'S' && v.coeff === -1);
    const hasArtificial = extraVars.some(v => v.type === 'D');

    // ── Choose the most natural sentence pattern ─────────────────────────
    let introPhrase = "By introducing ";

    if (hasSlack && !hasSurplus && !hasArtificial) {
        introPhrase += "slack variables";
    }
    else if (!hasSlack && hasSurplus && hasArtificial) {
        introPhrase += "surplus and artificial (dummy) variables";
    }
    else if (!hasSlack && !hasSurplus && hasArtificial) {
        introPhrase += "artificial (dummy) variables";
    }
    else if (hasSlack && hasSurplus && hasArtificial) {
        introPhrase += "slack, surplus and artificial (dummy) variables";
    }
    else if (hasSlack && hasArtificial && !hasSurplus) {
        introPhrase += "slack and artificial (dummy) variables";
    }
    else {
        introPhrase += "appropriate slack, surplus and/or artificial (dummy) variables";
    }

    introPhrase += " in the given problem, we get:\n\n";
    html += introPhrase;

    // ── Modified objective (with M terms strictly in the Introduction) ───
    html += (type === 'min' ? 'Min' : 'Max') + ' Z =';

    let modObjTerms = objTerms.slice();
    if (modObjTerms.length === 0) {
        modObjTerms.push(" 0");
    }

    extraVars.forEach(v => {
        let varName = `${v.type}${v.id}`;
        if (v.cost === 0) {
            modObjTerms.push(` + 0 ${formatVar(varName)}`);
        } else {
            let coefSign = v.cost > 0 ? ' +' : ' -';
            modObjTerms.push(`${coefSign} M ${formatVar(varName)}`);
        }
    });

    if (modObjTerms.length > 0) {
        let first = modObjTerms[0].trim();
        if (first.startsWith('+')) first = first.substring(1);
        html += ' ' + first + modObjTerms.slice(1).join('');
    }
    html += '\n\n';

    // ── Standard form constraints ────────────────────────────────────────
    html += 'Subject to Constraints:\n\n';

    rows.forEach((row, idx) => {
        let terms =[];
        activeVars.forEach(v => {
            let coef = parseFloat(row.querySelector(v.sel).value) || 0;
            if (coef !== 0) {
                let sign = coef > 0 ? ' +' : ' -';
                let absCoef = Math.abs(coef);
                let coefStr = absCoef === 1 ? '' : absCoef;
                terms.push(`${sign} ${coefStr}${formatVar(v.label)}`);
            }
        });

        // Add extra variables for this row
        extraVars.filter(ev => ev.row === idx).forEach(ev => {
            let sign = ev.coeff > 0 ? ' +' : ' -';
            let varName = `${ev.type}${ev.id}`;
            terms.push(`${sign} ${formatVar(varName)}`);
        });

        let conStr = terms.join('').trim();
        if (conStr.startsWith('+')) conStr = conStr.substring(1).trim();

        let rhs = parseFloat(row.querySelector('.conRHS').value) || 0;
        html += `     ${conStr || '0'} = ${rhs}\n`;
    });

    // All variables ≥ 0
    let allVarNames = activeVars.map(v => v.label).concat(extraVars.map(v => `${v.type}${v.id}`));
    html += '\nand   ' + allVarNames.map(formatVar).join(', ') + ' ≥ 0\n\n';

    // Final transition line
    html += 'Now, constructing simplex table to get optimal solution\n';

    html += '</div>';

    return html;
}

function generateFromForm() {
    const type = document.getElementById('type').value;
    const container = document.getElementById('table-container');
    container.innerHTML = ""; 

    // 1. SETUP COSTS & BIG M
    const rawInputs =[
        {id:'objX', label:'X1', sel:'.conX'}, 
        {id:'objY', label:'X2', sel:'.conY'}, 
        {id:'objZ', label:'X3', sel:'.conZ'}
    ];

    const rows = document.querySelectorAll('.constraint-row');
    
    let activeVars =[];
    rawInputs.forEach(v => {
        let val = parseFloat(document.getElementById(v.id).value);
        if (!isNaN(val) && val !== 0) {
            let hasInConstraint = false;
            rows.forEach((row) => {
                let conVal = parseFloat(row.querySelector(v.sel).value) || 0;
                if (conVal !== 0) {
                    hasInConstraint = true;
                }
            });
            
            if (hasInConstraint) {
                activeVars.push({...v, cost: val, cost_calc: val});
            }
        }
    });

    const maxVal = Math.max(...activeVars.map(v => Math.abs(v.cost)), 0);
    const numDigits = Math.ceil(Math.log10(maxVal + 1));
    const mDisplay = Math.pow(10, numDigits); 
    const mCalc = Math.pow(10, numDigits + 5); 

    const bigM_UI = (type === 'max') ? -mDisplay : mDisplay;
    const bigM_Calc = (type === 'max') ? -mCalc : mCalc;

    let extraVars =[];
    rows.forEach((row, idx) => {
        const op = row.querySelector('.operator').value;
        if (op === "<=") {
            extraVars.push({ type: 'S', id: extraVars.filter(v => v.type === 'S').length + 1, row: idx, coeff: 1, cost: 0, cost_calc: 0 });
        } else if (op === ">=") {
            extraVars.push({ type: 'S', id: extraVars.filter(v => v.type === 'S').length + 1, row: idx, coeff: -1, cost: 0, cost_calc: 0 });
            extraVars.push({ type: 'D', id: extraVars.filter(v => v.type === 'D').length + 1, row: idx, coeff: 1, cost: bigM_UI, cost_calc: bigM_Calc });
        } else {
            extraVars.push({ type: 'D', id: extraVars.filter(v => v.type === 'D').length + 1, row: idx, coeff: 1, cost: bigM_UI, cost_calc: bigM_Calc });
        }
    });

    let displayCj = activeVars.map(v => v.cost).concat(extraVars.map(v => v.cost));
    let calcCj = activeVars.map(v => v.cost_calc).concat(extraVars.map(v => v.cost_calc));

    let currentMatrix =[];
    rows.forEach((row, idx) => {
        let bj = parseFloat(row.querySelector('.conRHS').value) || 0;
        let rowData = [bj];
        activeVars.forEach(v => rowData.push(parseFloat(row.querySelector(v.sel).value) || 0));
        extraVars.forEach(v => rowData.push(v.row === idx ? v.coeff : 0));
        
        let initialVar = extraVars.find(v => v.row === idx && (v.type === 'D' || (v.type === 'S' && v.coeff === 1)));
        currentMatrix.push({ 
            cb: initialVar.cost, 
            cb_calc: initialVar.cost_calc, 
            xb: `${initialVar.type}${initialVar.id}`, 
            values: rowData 
        });
    });

    // Render Introduction Before Print Tables
    container.innerHTML += renderIntroduction(type, activeVars, extraVars, rows);

    // 2. ITERATION LOOP
    let iteration = 1, isOptimal = false;
    const MAX_LIMIT = 15;

    while (!isOptimal && iteration <= MAX_LIMIT) {
        let res = solveTable(currentMatrix, displayCj, calcCj, type, activeVars, extraVars);
        container.innerHTML += `<h2 class="title">Simplex Table ${numberToRoman(iteration)}</h2>` + res.html;

        if (!res.isOptimal) {
            if (res.pRow === -1) {
                container.innerHTML += `<div class="simplex-message unbounded" style="color:#d9534f;">The further solution is not possible because of non-existence of positive ratio. Hence, the solution is unbounded.</div>`;
                return; 
            }

            container.innerHTML += `<div class="simplex-message not-optimal">Since all the values of Z<sub>j</sub> - C<sub>j</sub> are ${type === 'max' ? 'not non-negative' : 'not non-positive'}, the solution is not optimal and we construct the next simplex table with the following workings:</div>`;
            container.innerHTML += renderWorkingsTable(currentMatrix, res.pRow, res.pCol, activeVars, extraVars);
            currentMatrix = calculateNextMatrix(currentMatrix, res.pRow, res.pCol, displayCj, calcCj, activeVars, extraVars);
            iteration++;
        } else {
            let zVal = toDecimal(res.zjDisplay[0]); 
            let varSummary = activeVars.map(v => {
                let found = currentMatrix.find(row => row.xb === v.label);
                return `${formatVar(v.label)} = ${found ? toFraction(found.values[0]) : "0"}`;
            }).join(", ");
            container.innerHTML += `<div class="simplex-message optimal">Since all the values of Z<sub>j</sub> - C<sub>j</sub> are ${type === 'max' ? 'non-negative' : 'non-positive'}, the solution is optimal. Hence, ${type.toUpperCase()} Z = ${zVal}, ${varSummary}</div>`;
            isOptimal = true;
        }
    }
}

function solveTable(matrix, dCj, cCj, type, activeVars, extraVars) {
    let zjRow = [], zjDisplay =[], totalCols = matrix[0].values.length;
    let epsilon = 1e-8;

    for (let c = 0; c < totalCols; c++) {
        let sumCalc = 0, sumDisplay = 0;
        matrix.forEach(r => {
            sumCalc += r.cb_calc * r.values[c];
            sumDisplay += r.cb * r.values[c];
        });
        zjRow.push(sumCalc);
        zjDisplay.push(sumDisplay);
    }

    let netEval = zjRow.slice(1).map((z, i) => z - cCj[i]);
    let pCol = -1;

    if (type === 'max') {
        let min = Math.min(...netEval);
        if (min < -epsilon) pCol = netEval.indexOf(min) + 3;
    } else {
        let max = Math.max(...netEval);
        if (max > epsilon) pCol = netEval.indexOf(max) + 3;
    }

    const isOptimal = (pCol === -1);
    let minRatio = Infinity, pRow = -1;
    if (!isOptimal) {
        matrix.forEach((row, idx) => {
            let entryVal = row.values[pCol - 2];
            if (entryVal > epsilon) {
                let ratio = row.values[0] / entryVal;
                if (ratio < minRatio) { minRatio = ratio; pRow = idx; }
            }
        });
    }

    // HTML RENDER with proper subscripts for Headers
    let html = `<div class="table-scroll-wrapper"><table><tr><td colspan="2"></td><td>C<sub>j</sub></td>`;
    dCj.forEach((c, i) => html += `<td class="${!isOptimal && i+3 === pCol ? 'pivot-column' : ''}">${toDecimal(c)}</td>`);
    html += `</tr><tr><td>C<sub>B</sub></td><td>X<sub>B</sub></td><td>b<sub>j</sub></td>`;
    activeVars.forEach((v, i) => html += `<td class="${!isOptimal && i+3 === pCol ? 'pivot-column' : ''}">${formatVar(v.label)}</td>`);
    extraVars.forEach((v, i) => html += `<td class="${!isOptimal && activeVars.length+i+3 === pCol ? 'pivot-column' : ''}">${formatVar(v.type + v.id)}</td>`);
    if (!isOptimal) html += `<td>Ratio</td>`;
    html += `</tr>`;

    matrix.forEach((rowData, idx) => {
        let isPR = (!isOptimal && idx === pRow);
        html += `<tr><td>${toDecimal(rowData.cb)}</td><td>${formatVar(rowData.xb)}</td><td class="${isPR ? 'pivot-row' : ''}">${toFraction(rowData.values[0])}</td>`;
        rowData.values.slice(1).forEach((val, cIdx) => {
            let isPC = (!isOptimal && cIdx+3 === pCol);
            html += `<td class="${isPC ? 'pivot-column' : ''} ${isPR ? 'pivot-row' : ''}">${toFraction(val)}</td>`;
        });
        
        if (!isOptimal) {
            let ratioVal;
            if (rowData.values[pCol - 2] > 0) {
                ratioVal = toDecimal(rowData.values[0] / rowData.values[pCol - 2]);
            } else if (rowData.values[pCol - 2] === 0) {
                ratioVal = "∞"; 
            } else {
                ratioVal = toDecimal(rowData.values[0] / rowData.values[pCol - 2]); 
            }
            
            // Adding CUSTOM SVG Right Arrow for Leaving Variable (Pivot Row)
            let arrowIndicator = isPR ? ` <svg width="30" height="14" viewBox="0 0 30 14" style="vertical-align: middle; margin-left: 6px;" stroke="#0056b3" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"><line x1="1" y1="7" x2="28" y2="7"></line><polyline points="22 1 29 7 22 13"></polyline></svg>` : '';
            html += `<td>${ratioVal}${arrowIndicator}</td>`;
        }
        html += `</tr>`;
    });

    html += `<tr><td colspan="2">Z<sub>j</sub></td>`;
    zjDisplay.forEach((z) => html += `<td>${toDecimal(z)}</td>`);
    html += `</tr><tr><td colspan="2">Z<sub>j</sub> - C<sub>j</sub></td><td></td>`;
    netEval.forEach((ev, i) => {
        let dEv = zjDisplay[i+1] - dCj[i];
        
        // Adding CUSTOM SVG Upward Arrow for Entering Variable (Pivot Column)
        let arrowIndicator = (!isOptimal && i + 3 === pCol) ? ` <svg width="14" height="30" viewBox="0 0 14 30" style="vertical-align: middle; margin-left: 6px;" stroke="#0056b3" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"><line x1="7" y1="29" x2="7" y2="2"></line><polyline points="1 8 7 1 13 8"></polyline></svg>` : '';
        html += `<td>${toDecimal(dEv)}${arrowIndicator}</td>`;
    });
    html += `</tr></table></div>`;

    return { html, isOptimal, pCol, pRow, zjDisplay };
}

function calculateNextMatrix(matrix, pRowIdx, pColIdx, dCj, cCj, activeVars, extraVars) {
    let next = JSON.parse(JSON.stringify(matrix));
    let pivotEl = matrix[pRowIdx].values[pColIdx - 2];
    
    next[pRowIdx].cb = dCj[pColIdx - 3];
    next[pRowIdx].cb_calc = cCj[pColIdx - 3];
    
    let varName = "";
    if (pColIdx - 3 < activeVars.length) {
        varName = activeVars[pColIdx - 3].label;
    } else {
        let ev = extraVars[pColIdx - 3 - activeVars.length];
        varName = `${ev.type}${ev.id}`;
    }
    next[pRowIdx].xb = varName;

    for (let j = 0; j < next[pRowIdx].values.length; j++) next[pRowIdx].values[j] /= pivotEl;
    for (let i = 0; i < matrix.length; i++) {
        if (i !== pRowIdx) {
            let factor = matrix[i].values[pColIdx - 2];
            for (let j = 0; j < next[i].values.length; j++) {
                next[i].values[j] = matrix[i].values[j] - (factor * next[pRowIdx].values[j]);
            }
        }
    }
    return next;
}

function renderWorkingsTable(matrix, pRowIdx, pColIdx, activeVars, extraVars) {
    let pivotEl = matrix[pRowIdx].values[pColIdx - 2];
    
    let enteringVarRaw = (pColIdx - 3 < activeVars.length)
        ? activeVars[pColIdx - 3].label
        : `${extraVars[pColIdx - 3 - activeVars.length].type}${extraVars[pColIdx - 3 - activeVars.length].id}`;
        
    let enteringVar = formatVar(enteringVarRaw);
    let pivotXb = formatVar(matrix[pRowIdx].xb);
    
    let isWholePivot = Math.abs(pivotEl - Math.round(pivotEl)) < 1e-8;
    let pivotFrac = toFraction(pivotEl);
    let pivotDisplay = pivotFrac.includes('/') ? `(${pivotFrac})` : pivotFrac;
    
    let invPivotFrac = toFraction(1 / pivotEl);
    let invPivotDisplay = invPivotFrac.includes('/') ? `(${invPivotFrac})` : invPivotFrac;
    
    // Injecting CSS specifically for a compact workings table
    let html = `<style>
        .compact-workings-table {
            border-collapse: collapse;
            width: 100%;
            font-family: 'Arial Narrow', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            font-size: 13px;
            letter-spacing: -0.2px;
            margin-bottom: 24px;
        }
        .compact-workings-table th {
            background-color: #f4f6f8;
            border: 1px solid #ccc;
            padding: 6px 8px;
            font-weight: 600;
            white-space: nowrap;
            color: #333;
        }
        .compact-workings-table td {
            border: 1px solid #ccc;
            padding: 5px 8px;
            white-space: nowrap;
            color: #444;
            text-align: center;
        }
    </style>`;

    html += `<div class="workings-container" style="overflow-x: auto; margin-top: 12px;"><table class="compact-workings-table"><tr>`;
    
    let opIdx = 0;
    
    if (isWholePivot) {
        html += `<th>(${String.fromCharCode(97 + opIdx)}) ${pivotXb} ÷ ${pivotDisplay} = ${enteringVar}</th>`;
    } else {
        html += `<th>(${String.fromCharCode(97 + opIdx)}) ${pivotXb} × ${invPivotDisplay} = ${enteringVar}</th>`;
    }
    opIdx++;
    
    for (let i = 0; i < matrix.length; i++) {
        if (i === pRowIdx) continue;
        
        let rowXb = formatVar(matrix[i].xb);
        let factor = matrix[i].values[pColIdx - 2];
        let factorFrac = toFraction(factor);
        let absFactorFrac = toFraction(Math.abs(factor));
        
        let factorD = factorFrac.includes('/') ? `(${factorFrac})` : factorFrac;
        let absFactorD = absFactorFrac.includes('/') ? `(${absFactorFrac})` : absFactorFrac;
        
        let showCoeff = Math.abs(factor) !== 1 && factor !== 0;
        let coeffPart = showCoeff ? factorD + " × " : "";
        let absCoeffPart = showCoeff ? absFactorD + " × " : "";
        
        let headerText;
        if (Math.abs(factor) < 1e-10) {
            headerText = `${rowXb} - 0 × ${enteringVar} = ${rowXb}`;
        } else if (factor > 0) {
            headerText = `${rowXb} - ${coeffPart}${enteringVar} = ${rowXb}`;
        } else {
            headerText = `${rowXb} + ${absCoeffPart}${enteringVar} = ${rowXb}`;
        }
        
        html += `<th>(${String.fromCharCode(97 + opIdx)}) ${headerText}</th>`;
        opIdx++;
    }
    html += `</tr>`;
    
    for (let e = 0; e < matrix[0].values.length; e++) {
        html += `<tr>`;
        
        let oldP = toFraction(matrix[pRowIdx].values[e]);
        let newP = toFraction(matrix[pRowIdx].values[e] / pivotEl);
        
        let oldPD = oldP.includes('/') ? `(${oldP})` : oldP;
        let newPD = newP.includes('/') ? `(${newP})` : newP;
        
        if (isWholePivot) {
            html += `<td>${oldPD} ÷ ${pivotDisplay} = ${newPD}</td>`;
        } else {
            html += `<td>${oldPD} × ${invPivotDisplay} = ${newPD}</td>`;
        }
        
        for (let i = 0; i < matrix.length; i++) {
            if (i === pRowIdx) continue;
            
            let row = matrix[i];
            let factor = row.values[pColIdx - 2];
            let oldVal = row.values[e];
            let newPivotVal = matrix[pRowIdx].values[e] / pivotEl;
            let result = oldVal - factor * newPivotVal;
            
            let oldF = toFraction(oldVal);
            let facF = toFraction(factor);
            let newPvF = toFraction(newPivotVal);
            let resF = toFraction(result);
            
            let oldFD = oldF.includes('/') ? `(${oldF})` : oldF;
            let facFD = facF.includes('/') ? `(${facF})` : facF;
            let newPvD = newPvF.includes('/') ? `(${newPvF})` : newPvF;
            let resFD = resF.includes('/') ? `(${resF})` : resF;
            
            let showCoeff = Math.abs(factor) !== 1 && Math.abs(factor) > 1e-10;
            let coeffPart = showCoeff ? facFD + " × " : "";
            let absCoeffPart = showCoeff ? `(${toFraction(Math.abs(factor)).includes('/') ? `(${toFraction(Math.abs(factor))})` : toFraction(Math.abs(factor))}) × ` : "";
            
            let calc;
            if (Math.abs(factor) < 1e-10) {
                calc = `${oldFD} - 0 × ${newPvD} = ${resFD}`;
            } else if (factor > 0) {
                calc = `${oldFD} - ${coeffPart}${newPvD} = ${resFD}`;
            } else {
                calc = `${oldFD} + ${absCoeffPart}${newPvD} = ${resFD}`;
            }
            
            html += `<td>${calc}</td>`;
        }
        
        html += `</tr>`;
    }
    
    html += `</table></div>`;
    return html;
}

function addConstraintRow() {
    const constraintsList = document.getElementById('constraints-list');
    const newRow = document.createElement('div');
    newRow.classList.add('constraint-row');
    
    newRow.innerHTML = `
        <input type="number" class="conX"> <span class="var-label">X<sub>1</sub> +</span>
        <input type="number" class="conY"> <span class="var-label">X<sub>2</sub> +</span>
        <input type="number" class="conZ"> <span class="var-label">X<sub>3</sub></span>
        <select class="operator">
            <option value="<=">≤</option>
            <option value=">=">≥</option>
            <option value="=">=</option>
        </select>
        <input type="number" class="conRHS">
    `;
    constraintsList.appendChild(newRow);
}

function resetForm() {
    // 1. Clear all number inputs (Objective and Constraints)
    const inputs = document.querySelectorAll('input[type="number"]');
    inputs.forEach(input => {
        input.value = "";
    });

    // 2. Reset dropdowns to their first option (Maximize and <=)
    const selects = document.querySelectorAll('select');
    selects.forEach(select => {
        select.selectedIndex = 0;
    });

    // 3. Remove all extra constraint rows except the first one
    const constraintList = document.getElementById('constraints-list');
    while (constraintList.children.length > 1) {
        constraintList.removeChild(constraintList.lastChild);
    }

    // 4. Clear the results container
    const container = document.getElementById('table-container');
    container.innerHTML = "";
    
    // Optional: Scroll back to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}