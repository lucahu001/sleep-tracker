// 獲取 HTML 元素
const sleepButton = document.getElementById('sleepButton');
const wakeButton = document.getElementById('wakeButton');
const sleepRecordsUl = document.getElementById('sleepRecords');
const sleepChartCanvas = document.getElementById('sleepChart');
const confirmModal = document.getElementById('confirmModal'); // 確認刪除彈出視窗
const confirmYesBtn = document.getElementById('confirmYes'); // 確認刪除「是」按鈕
const confirmNoBtn = document.getElementById('confirmNo');   // 確認刪除「否」按鈕

let chartInstance = null; // 用來儲存 Chart.js 實例，以便更新

// 儲存睡眠數據的陣列
// 試著從 localStorage 載入數據，如果沒有則初始化為空陣列
let sleepData = JSON.parse(localStorage.getItem('sleepData')) || [];

// 追蹤當前等待刪除的記錄 ID
let currentRecordToDeleteId = null;

// 函數：將日期格式化為 YYYY-MM-DD
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 函數：將時間格式化為 HH:MM:SS
function formatTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

/**
 * 將睡眠記錄保存到 localStorage
 * @returns {void}
 */
function saveRecords() {
    try {
        localStorage.setItem('sleepData', JSON.stringify(sleepData));
        console.log('睡眠記錄已保存:', sleepData); // 偵錯日誌
    } catch (error) {
        console.error('保存記錄到 localStorage 失敗:', error);
    }
}

/**
 * 從 localStorage 加載睡眠記錄
 * @returns {void}
 */
function loadRecords() {
    try {
        const storedRecords = localStorage.getItem('sleepData');
        if (storedRecords) {
            sleepData = JSON.parse(storedRecords);
            let needsSave = false; // 標記是否需要重新保存數據

            sleepData.forEach(record => {
                // 確保時間字串轉換為 Date 物件以便計算
                record.startTime = new Date(record.startTime);
                if (record.endTime) {
                    record.endTime = new Date(record.endTime);
                }

                // 如果記錄沒有 ID，則為其生成一個新的 ID
                // 這解決了舊紀錄無法刪除的問題
                if (!record.id) {
                    // 使用時間戳加一小段隨機字串確保唯一性
                    record.id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
                    needsSave = true; // 標記為需要保存
                    console.log(`舊紀錄 (開始時間: ${record.startTime.toISOString()}) 已生成新ID: ${record.id}`);
                }
            });

            // 如果有任何記錄被賦予了新 ID，則重新保存數據
            if (needsSave) {
                saveRecords();
                console.log('舊紀錄已更新並保存新ID到 localStorage。');
            }

            console.log('載入的睡眠記錄:', sleepData); // 偵錯日誌
        } else {
            console.log('localStorage 中沒有找到睡眠記錄。'); // 偵錯日誌
        }
    } catch (error) {
        console.error('從 localStorage 加載記錄失敗:', error);
        sleepData = []; // 如果加載失敗，初始化為空陣列
    }
}

// 函數：顯示睡眠記錄 (已新增刪除按鈕)
function displaySleepRecords() {
    console.log('開始渲染睡眠記錄...'); // 偵錯日誌
    sleepRecordsUl.innerHTML = ''; // 清空現有記錄

    // 反轉陣列，讓最新記錄顯示在最上面
    const sortedRecords = [...sleepData].reverse();

    if (sortedRecords.length === 0) {
        const noRecordsLi = document.createElement('li');
        noRecordsLi.textContent = '目前沒有睡眠記錄。';
        sleepRecordsUl.appendChild(noRecordsLi);
        console.log('沒有睡眠記錄，顯示提示訊息。'); // 偵錯日誌
        return;
    }

    sortedRecords.forEach(record => {
        const li = document.createElement('li');
        const startDate = new Date(record.startTime);
        const endDate = record.endTime ? new Date(record.endTime) : null;

        let durationHours = 0;
        if (endDate) {
            durationHours = (endDate - startDate) / (1000 * 60 * 60); // 毫秒轉小時
            li.innerHTML = `
                <span class="record-details">
                    日期: ${formatDate(startDate)} <br>
                    入睡: ${formatTime(startDate)} - 起床: ${formatTime(endDate)} <br>
                    總睡眠時數: ${durationHours.toFixed(2)} 小時
                </span>
                <button class="delete-button" data-id="${record.id}">刪除</button>
            `;
            if (durationHours < 6) {
                li.classList.add('short-sleep');
            } else {
                li.classList.add('good-sleep');
            }
        } else {
            li.innerHTML = `
                <span class="record-details">
                    日期: ${formatDate(startDate)} <br>
                    入睡時間: ${formatTime(startDate)} (仍在睡眠中...)
                </span>
                <button class="delete-button" data-id="${record.id}" disabled>刪除</button> `;
        }
        sleepRecordsUl.appendChild(li);
        console.log('已新增記錄項目:', record.id); // 偵錯日誌
    });
    console.log('睡眠記錄渲染完成。'); // 偵錯日誌
}

// Chart.js 外掛：繪製一條紅色水平線
const redLinePlugin = {
    id: 'redLine',
    beforeDraw: (chart) => {
        const { ctx, chartArea: { top, bottom, left, right, width, height }, scales: { x, y } } = chart;
        ctx.save();

        // 睡眠時數 6 小時的 Y 軸位置
        const sixHoursY = y.getPixelForValue(6);

        // 如果 6 小時的位置在圖表範圍內，則繪製線條
        if (sixHoursY >= top && sixHoursY <= bottom) {
            ctx.beginPath();
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]); // 虛線
            ctx.moveTo(left, sixHoursY);
            ctx.lineTo(right, sixHoursY);
            ctx.stroke();
            ctx.restore();
        }
    }
};

// 函數：更新圖表
function updateChart() {
    // 準備圖表數據
    const chartLabels = [];
    const chartData = [];
    const dateCountMap = {}; // 用於追蹤同一天的記錄次數

    sleepData.forEach(record => {
        if (record.startTime && record.endTime) {
            const startDate = new Date(record.startTime);
            const endDate = new Date(record.endTime);
            const dateStr = formatDate(startDate);
            const durationHours = (endDate - startDate) / (1000 * 60 * 60);

            // 檢查是否為同一天內的重複記錄
            if (!dateCountMap[dateStr]) {
                dateCountMap[dateStr] = 0;
            }
            dateCountMap[dateStr]++;

            let label = dateStr;
            // 如果同一天有多筆記錄，新增 (1), (2) 的標記
            if (dateCountMap[dateStr] > 1) {
                label += ` (${dateCountMap[dateStr]})`;
            }

            chartLabels.push(label);
            chartData.push(durationHours.toFixed(2));
        }
    });

    // 計算 Y 軸的最大值
    const maxSleep = Math.max(...chartData, 10); // 確保最小值為 10
    const suggestedMax = Math.ceil(maxSleep / 2) * 2; // 將最大值四捨五入到最接近的偶數

    // 如果圖表已經存在，先銷毀它
    if (chartInstance) {
        chartInstance.destroy();
    }

    // 重新創建一個新圖表
    const ctx = sleepChartCanvas.getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartLabels,
            datasets: [{
                label: '睡眠時數',
                data: chartData,
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1,
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '睡眠時數 (小時)'
                    },
                    min: 1,  // 設定 Y 軸的最小值為 1
                    max: suggestedMax, // 根據數據動態調整最大值
                    ticks: {
                        stepSize: 1,
                        callback: function(value) {
                            if (Number.isInteger(value)) {
                                return value;
                            }
                            return null;
                        }
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: '日期'
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        autoSkip: false // 確保所有標籤都顯示
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + context.parsed.y + ' 小時';
                        }
                    }
                },
                redLine: {} // 啟用外掛
            }
        },
        plugins: [redLinePlugin] // 在這裡註冊外掛
    });
}

/**
 * 處理刪除記錄的確認邏輯
 * @param {string} id - 要刪除的記錄 ID
 * @returns {void}
 */
function deleteRecord(id) {
    // 過濾掉要刪除的記錄
    const initialLength = sleepData.length;
    sleepData = sleepData.filter(record => record.id !== id);
    if (sleepData.length < initialLength) {
        console.log(`記錄 ID: ${id} 已刪除.`); // 偵錯日誌
    } else {
        console.log(`未找到記錄 ID: ${id} 進行刪除.`); // 偵錯日誌
    }

    saveRecords();    // 保存到 localStorage
    displaySleepRecords();    // 重新渲染列表
    updateChart();            // 更新圖表
    displayCustomAlert('睡眠記錄已成功刪除。'); // 使用 custom alert 替換 alert()
}

// 使用事件委派監聽睡眠記錄列表上的點擊事件
// 這樣即使動態新增了記錄，其上的刪除按鈕也能被監聽
sleepRecordsUl.addEventListener('click', (event) => {
    // 檢查點擊的目標是否為 'delete-button' 類型的按鈕，且按鈕未被禁用
    if (event.target.classList.contains('delete-button') && !event.target.disabled) {
        currentRecordToDeleteId = event.target.dataset.id; // 獲取要刪除的記錄 ID
        confirmModal.style.display = 'flex'; // 顯示確認彈出視窗
        console.log('顯示確認刪除彈出視窗，待刪除ID:', currentRecordToDeleteId); // 偵錯日誌
    }
});

// 監聽確認彈出視窗中的「是」按鈕點擊
confirmYesBtn.addEventListener('click', () => {
    if (currentRecordToDeleteId) {
        deleteRecord(currentRecordToDeleteId); // 執行刪除操作
    }
    confirmModal.style.display = 'none'; // 隱藏彈出視窗
    currentRecordToDeleteId = null; // 清除當前待刪除 ID
    console.log('確認刪除並關閉彈出視窗。'); // 偵錯日誌
});

// 監聽確認彈出視窗中的「否」按鈕點擊
confirmNoBtn.addEventListener('click', () => {
    confirmModal.style.display = 'none'; // 隱藏彈出視窗
    currentRecordToDeleteId = null; // 清除當前待刪除 ID
    console.log('刪除操作已取消。'); // 偵錯日誌
});

// 點擊彈出視窗外部時關閉視窗
window.addEventListener('click', (event) => {
    if (event.target === confirmModal) {
        confirmModal.style.display = 'none';
        currentRecordToDeleteId = null;
        console.log('點擊外部關閉彈出視窗。'); // 偵錯日誌
    }
});

// --- 自定義提示訊息框 (替代 alert()) ---
const customAlertId = 'customAlert'; // 給 custom alert 的 ID

function displayCustomAlert(message) {
    let alertBox = document.getElementById(customAlertId);
    if (!alertBox) {
        alertBox = document.createElement('div');
        alertBox.id = customAlertId;
        alertBox.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: #333;
            color: white;
            padding: 15px 25px;
            border-radius: 8px;
            z-index: 2000;
            box-shadow: 0 4px 10px rgba(0,0,0,0.2);
            font-size: 1em;
            opacity: 0;
            transition: opacity 0.3s ease-in-out;
        `;
        document.body.appendChild(alertBox);
    }
    alertBox.textContent = message;
    alertBox.style.opacity = '1';

    setTimeout(() => {
        alertBox.style.opacity = '0';
        // 可選：等待過渡結束後移除元素
        setTimeout(() => {
            if (alertBox.parentNode) {
                alertBox.parentNode.removeChild(alertBox);
            }
        }, 300); // 應與 transition-duration 匹配
    }, 2000); // 顯示 2 秒
}


// 事件監聽：入睡按鈕
sleepButton.addEventListener('click', () => {
    // 檢查是否已經有未結束的睡眠記錄
    const lastRecord = sleepData[sleepData.length - 1];
    if (lastRecord && !lastRecord.endTime) {
        displayCustomAlert('你已經在睡眠中了，請先點擊「起床」按鈕！'); // 使用 custom alert
        return;
    }

    const newRecordId = Date.now().toString() + Math.random().toString(36).substring(2, 9); // 為新記錄生成一個更唯一的 ID
    const startTime = new Date().toISOString(); // 將時間儲存為 ISO 格式字串
    sleepData.push({ id: newRecordId, startTime: startTime, endTime: null }); // 儲存 ID
    saveRecords(); // 儲存到 localStorage
    displaySleepRecords(); // 更新記錄顯示
    sleepButton.disabled = true;
    wakeButton.disabled = false;
    displayCustomAlert('入睡時間已記錄。'); // 使用 custom alert
});

// 事件監聽：起床按鈕
wakeButton.addEventListener('click', () => {
    const lastRecord = sleepData[sleepData.length - 1];
    if (lastRecord && !lastRecord.endTime) {
        lastRecord.endTime = new Date().toISOString();
        saveRecords(); // 儲存到 localStorage
        displaySleepRecords(); // 更新記錄顯示
        updateChart(); // 更新圖表
        sleepButton.disabled = false;
        wakeButton.disabled = true;
        displayCustomAlert('起床時間已記錄，睡眠記錄已新增。'); // 使用 custom alert
    } else {
        displayCustomAlert('你還沒有點擊「入睡」按鈕！'); // 使用 custom alert
    }
});

// 初始化：頁面載入時執行
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded 事件觸發，開始初始化...'); // 偵錯日誌
    loadRecords(); // 載入記錄（這會處理舊紀錄沒有 ID 的情況）
    displaySleepRecords(); // 顯示現有記錄
    updateChart(); // 繪製圖表

    // 檢查是否有正在進行的睡眠，以設定按鈕狀態
    const lastRecord = sleepData[sleepData.length - 1];
    if (lastRecord && !lastRecord.endTime) {
        sleepButton.disabled = true;
        wakeButton.disabled = false;
    } else {
        sleepButton.disabled = false;
        wakeButton.disabled = true;
    }
    console.log('初始化完成。'); // 偵錯日誌
});