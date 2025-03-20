class HanziApp {
    constructor() {
        this.characters = [];
        this.currentIndex = 0;
        this.progress = {};
        this.isReviewMode = false;
        this.audio = new Audio();
        this.strokes = [];
        this.currentStroke = [];
        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;
        
        // 汉字笔画数据库，可扩展
        this.strokesDatabase = {
            "一": 1,
            "二": 2,
            "三": 3,
            "人": 2,
            "口": 3,
            "日": 4,
            "月": 4,
            "山": 3,
            "水": 4,
            "火": 4,
            "木": 4,
            "土": 3,
            "大": 3,
            "小": 3,
            "中": 4,
            "上": 3,
            "下": 3,
            "子": 3,
            "手": 4,
            "足": 7
        };
        
        // 表情符号库，对应不同的反馈场景
        this.emojis = {
            correct: ['🎉', '👏', '🌟', '😊', '🥳', '👍', '💯'],
            almost: ['🙂', '👌', '🔍', '💪', '🤔', '👀'],
            incorrect: ['💪', '🧐', '🔄', '✏️', '📝', '🤗', '🌈']
        };
        
        // 语音反馈短语库
        this.feedbackPhrases = {
            correct: [
                '太棒了',
                '真厉害',
                '写得真好',
                '做得漂亮',
                '你真聪明'
            ],
            almost: [
                '接近了',
                '差一点点',
                '快对了',
                '再仔细看看',
                '很不错哦'
            ],
            incorrect: [
                '再试一次',
                '不要着急',
                '你可以的',
                '慢慢来',
                '多练习一下'
            ]
        };
        
        // 初始化弹窗元素
        this.popup = document.querySelector('.result-popup');
        this.overlay = document.querySelector('.popup-overlay');
        this.popupButton = this.popup.querySelector('.button');
        
        // 绑定弹窗按钮事件
        this.popupButton.addEventListener('click', () => this.hidePopup());
        
        this.init();
        
        // 添加页面滚动事件监听，确保笔画不会在页面滚动时丢失
        window.addEventListener('scroll', () => this.handleWindowScroll());
    }

    async init() {
        // 先初始化画布
        this.canvas = document.getElementById('writingCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.setupCanvas();
        this.drawGrid(); // 立即绘制田字格
        
        await this.loadCharacters();
        await this.loadProgress();
        this.setupEventListeners();
        this.updateDisplay();
        
        console.log('应用初始化完成');
    }

    async loadCharacters() {
        try {
            const response = await fetch('/api/characters');
            if (!response.ok) {
                throw new Error(`HTTP错误: ${response.status}`);
            }
            const data = await response.json();
            this.characters = data.characters;
            console.log('加载汉字数据成功', this.characters);
            this.updateProgressBar();
        } catch (error) {
            console.error('加载汉字数据出错:', error);
            // 使用默认汉字数据
            this.characters = [
                { character: "一", pinyin: "yī" },
                { character: "二", pinyin: "èr" },
                { character: "三", pinyin: "sān" }
            ];
        }
    }

    async loadProgress() {
        try {
            const response = await fetch('/api/progress');
            if (!response.ok) {
                throw new Error(`HTTP错误: ${response.status}`);
            }
            this.progress = await response.json();
            console.log('加载进度数据成功', this.progress);
            this.updateProgressBar();
        } catch (error) {
            console.error('加载进度数据出错:', error);
            this.progress = {};
            this.updateProgressBar(); // 确保即使出错也更新进度条
        }
    }

    async updateProgress(character, learned) {
        try {
            console.log('正在更新进度', character, learned);
            
            // 更新本地缓存，即使API调用失败也能保持状态
            if (!this.progress[character]) {
                this.progress[character] = {};
            }
            this.progress[character].learned = learned;
            this.progress[character].last_reviewed = new Date().toISOString();
            
            // 更新界面
            this.updateProgressBar();
            
            // 发送到服务器
            const response = await fetch('/api/progress', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ character, learned }),
            });
            
            if (!response.ok) {
                throw new Error(`HTTP错误: ${response.status}`);
            }
            
            console.log('更新进度成功');
            return true;
        } catch (error) {
            console.error('更新进度出错:', error);
            // 已在函数开始更新了本地进度，所以这里不需要重复
            return false;
        }
    }

    updateProgressBar() {
        const total = this.characters.length || 1; // 避免除以0
        const learned = Object.values(this.progress).filter(p => p.learned).length;
        const progress = (learned / total) * 100;
        console.log('更新进度条', progress, '%', '学习了', learned, '个字', '总共', total, '个字');
        console.log('当前进度对象:', JSON.stringify(this.progress));
        
        // 适配页面上的进度条结构
        const progressBar = document.querySelector('#progressBar .progress') || document.querySelector('.progress');
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
            
            // 确保进度条可见
            if (progress > 0) {
                progressBar.style.minWidth = '5px';
                progressBar.style.display = 'block'; // 确保显示
            } else {
                progressBar.style.minWidth = '0';
            }
        }
        
        // 显示学习进度数字
        const progressContainer = document.querySelector('#progressBar') || document.querySelector('.progress-container');
        if (progressContainer) {
            let progressText = progressContainer.querySelector('.progress-text');
            if (!progressText) {
                progressText = document.createElement('div');
                progressText.className = 'progress-text';
                progressContainer.appendChild(progressText);
            }
            progressText.textContent = `已学习: ${learned}/${total}`;
        }
    }

    setupEventListeners() {
        document.querySelector('#learnBtn').addEventListener('click', () => this.setMode(false));
        document.querySelector('#reviewBtn').addEventListener('click', () => this.setMode(true));
        document.querySelector('#speakBtn').addEventListener('click', () => this.speak());
        document.querySelector('#nextBtn').addEventListener('click', () => this.nextCharacter());
        document.querySelector('#clearBtn').addEventListener('click', () => this.clearCanvas());
        document.querySelector('#checkBtn').addEventListener('click', () => this.checkWriting());
        
        console.log('事件监听绑定状态:', {
            learnBtn: !!document.querySelector('#learnBtn'),
            reviewBtn: !!document.querySelector('#reviewBtn'),
            speakBtn: !!document.querySelector('#speakBtn'),
            nextBtn: !!document.querySelector('#nextBtn'),
            clearBtn: !!document.querySelector('#clearBtn'),
            checkBtn: !!document.querySelector('#checkBtn')
        });
    }

    setupCanvas() {
        // 设置画布大小
        const resizeCanvas = () => {
            const rect = this.canvas.parentElement.getBoundingClientRect();
            this.canvas.width = rect.width;
            this.canvas.height = 300;
            
            // 保存当前笔画
            const savedStrokes = [...this.strokes];
            
            // 重新绘制田字格
            this.drawGrid();
            
            // 重新绘制所有已保存的笔画
            this.redrawStrokes(savedStrokes);
        };

        // 初始调整大小
        resizeCanvas();
        // 监听窗口大小变化
        window.addEventListener('resize', resizeCanvas);

        // 设置画笔样式 - 不画点，只画线
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 15; // 大幅增加线条粗细到15
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        // 绑定事件处理函数
        this.canvas.addEventListener('mousedown', (e) => {
            console.log('鼠标按下', e.clientX, e.clientY);
            this.startDrawing(e);
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isDrawing) {
                this.draw(e);
            }
        });
        
        this.canvas.addEventListener('mouseup', () => {
            console.log('鼠标释放');
            this.stopDrawing();
        });
        
        this.canvas.addEventListener('mouseout', () => {
            if (this.isDrawing) {
                console.log('鼠标移出');
                this.stopDrawing();
            }
        });

        // 只阻止canvas区域的触摸事件默认行为，而不是整个文档
        // 避免阻止页面正常滚动
        this.canvas.addEventListener('touchmove', function(e) {
            e.preventDefault();
        }, { passive: false });

        // 触摸事件支持
        this.canvas.addEventListener('touchstart', (e) => {
            console.log('触摸开始');
            e.preventDefault();
            e.stopPropagation(); // 防止事件冒泡
            this.handleTouch(e);
        }, { passive: false });
        
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            e.stopPropagation(); // 防止事件冒泡
            this.handleTouch(e);
        }, { passive: false });
        
        this.canvas.addEventListener('touchend', (e) => {
            console.log('触摸结束');
            e.preventDefault();
            e.stopPropagation(); // 防止事件冒泡
            this.stopDrawing();
        }, { passive: false });
        
        console.log('画布设置完成');
    }

    startDrawing(e) {
        this.isDrawing = true;
        const [x, y] = this.getCoordinates(e);
        this.lastX = x;
        this.lastY = y;
        this.currentStroke = [[x, y]];
        
        // 不再绘制起始点，改为直接开始绘制线条
        // 这样可以避免起点处的黑色圆球
    }

    draw(e) {
        if (!this.isDrawing) return;
        const [currentX, currentY] = this.getCoordinates(e);
        
        // 确保使用更粗的线条
        this.ctx.lineWidth = 15;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        this.ctx.beginPath();
        this.ctx.moveTo(this.lastX, this.lastY);
        this.ctx.lineTo(currentX, currentY);
        this.ctx.stroke();
        
        this.lastX = currentX;
        this.lastY = currentY;
        this.currentStroke.push([currentX, currentY]);
    }

    stopDrawing() {
        if (this.isDrawing) {
            this.isDrawing = false;
            if (this.currentStroke.length > 1) {
                this.strokes.push([...this.currentStroke]);
            }
        }
    }

    handleTouch(e) {
        const touch = e.touches[0];
        if (!touch) return;
        
        const rect = this.canvas.getBoundingClientRect();
        
        // 计算触摸位置相对于画布的准确坐标
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const x = (touch.clientX - rect.left) * scaleX;
        const y = (touch.clientY - rect.top) * scaleY;
        
        if (e.type === 'touchstart') {
            console.log('触摸开始坐标', x, y);
            this.isDrawing = true;
            this.lastX = x;
            this.lastY = y;
            this.currentStroke = [[x, y]];
            
            // 不再绘制起始点，改为直接开始绘制线条
            // 这样可以避免起点处的黑色圆球
        } else if (e.type === 'touchmove' && this.isDrawing) {
            // 确保使用更粗的线条
            this.ctx.lineWidth = 15;
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            
            this.ctx.beginPath();
            this.ctx.moveTo(this.lastX, this.lastY);
            this.ctx.lineTo(x, y);
            this.ctx.stroke();
            
            this.lastX = x;
            this.lastY = y;
            this.currentStroke.push([x, y]);
        }
    }

    getCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        return [
            (e.clientX - rect.left) * scaleX,
            (e.clientY - rect.top) * scaleY
        ];
    }

    drawGrid() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        // 清空画布
        ctx.clearRect(0, 0, width, height);

        // 绘制外框
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, width, height);

        // 绘制田字格
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;

        // 横线
        ctx.beginPath();
        ctx.moveTo(0, height/2);
        ctx.lineTo(width, height/2);
        ctx.stroke();

        // 竖线
        ctx.beginPath();
        ctx.moveTo(width/2, 0);
        ctx.lineTo(width/2, height);
        ctx.stroke();

        // 绘制对角线
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(width, height);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(width, 0);
        ctx.lineTo(0, height);
        ctx.stroke();

        // 绘制参考点
        ctx.fillStyle = '#ddd';
        const points = [
            [width/4, height/4],
            [width*3/4, height/4],
            [width/4, height*3/4],
            [width*3/4, height*3/4]
        ];
        points.forEach(point => {
            ctx.beginPath();
            ctx.arc(point[0], point[1], 2, 0, Math.PI * 2);
            ctx.fill();
        });
        
        // 重置画笔颜色
        ctx.strokeStyle = '#000';
        ctx.fillStyle = '#000';
    }

    setMode(isReview) {
        this.isReviewMode = isReview;
        const learnBtn = document.querySelector('#learnBtn');
        const reviewBtn = document.querySelector('#reviewBtn');
        
        if (learnBtn) learnBtn.classList.toggle('active', !isReview);
        if (reviewBtn) reviewBtn.classList.toggle('active', isReview);
        
        this.currentIndex = 0;
        this.updateDisplay();
    }

    async speak() {
        const currentChar = this.characters[this.currentIndex].character;
        try {
            const response = await fetch(`/api/tts?text=${encodeURIComponent(currentChar)}`);
            if (response.ok) {
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                this.audio.src = url;
                this.audio.play();
            } else {
                // 使用浏览器默认语音
                const utterance = new SpeechSynthesisUtterance(currentChar);
                utterance.lang = 'zh-CN';
                speechSynthesis.speak(utterance);
            }
        } catch (error) {
            console.error('Error playing audio:', error);
            // 使用浏览器默认语音作为备选
            const utterance = new SpeechSynthesisUtterance(currentChar);
            utterance.lang = 'zh-CN';
            speechSynthesis.speak(utterance);
        }
    }

    nextCharacter() {
        this.currentIndex = (this.currentIndex + 1) % this.characters.length;
        this.updateDisplay();
        this.clearCanvas();
    }

    clearCanvas() {
        this.drawGrid();
        this.strokes = [];
        this.currentStroke = [];
        console.log('画布已清除');
    }

    // 获取随机反馈表情
    getRandomEmoji(type) {
        const emojis = this.emojis[type] || this.emojis.correct;
        return emojis[Math.floor(Math.random() * emojis.length)];
    }
    
    // 获取随机反馈短语
    getRandomPhrase(type) {
        const phrases = this.feedbackPhrases[type] || this.feedbackPhrases.correct;
        return phrases[Math.floor(Math.random() * phrases.length)];
    }

    showPopup(isCorrect, message, subMessage) {
        // 设置弹窗样式和内容
        const feedbackType = isCorrect ? (message.includes('接近') ? 'almost' : 'correct') : 'incorrect';
        this.popup.className = `result-popup ${isCorrect ? 'correct' : 'incorrect'}`;
        this.popup.querySelector('.icon').textContent = this.getRandomEmoji(feedbackType);
        this.popup.querySelector('.message').textContent = message;
        this.popup.querySelector('.sub-message').textContent = subMessage;
        this.popupButton.textContent = isCorrect ? '太棒了！继续' : '再试一次';
        
        // 显示弹窗和遮罩
        this.popup.classList.add('show');
        this.overlay.classList.add('show');
    }

    hidePopup() {
        this.popup.classList.remove('show');
        this.overlay.classList.remove('show');
    }

    // 添加语音提示功能
    async speakFeedback(text) {
        try {
            // 确保每次获取新的音频，避免缓存问题
            const timestamp = new Date().getTime();
            const audioUrl = `/api/tts?text=${encodeURIComponent(text)}&t=${timestamp}`;
            console.log('请求新音频：', audioUrl);
            
            // 直接创建新的Audio对象而不是复用
            const audioElement = new Audio();
            
            // 使用fetch获取音频blob
            const response = await fetch(audioUrl);
            if (!response.ok) {
                throw new Error('语音API请求失败');
            }
            
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            
            return new Promise((resolve, reject) => {
                audioElement.src = url;
                audioElement.onended = () => {
                    URL.revokeObjectURL(url);
                    console.log('音频播放结束');
                    resolve();
                };
                audioElement.onerror = (e) => {
                    URL.revokeObjectURL(url);
                    console.error('音频播放失败', e);
                    reject(new Error('音频播放失败'));
                };
                
                // 确保之前的音频已停止
                if (this.audio && !this.audio.paused) {
                    this.audio.pause();
                    this.audio.currentTime = 0;
                }
                
                this.audio = audioElement;
                audioElement.play().catch(error => {
                    console.error('播放失败:', error);
                    reject(error);
                });
            });
        } catch (error) {
            console.error('语音提示出错:', error);
            // 使用浏览器默认语音作为备选
            if (window.speechSynthesis) {
                window.speechSynthesis.cancel(); // 先取消之前的语音
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = 'zh-CN';
                speechSynthesis.speak(utterance);
            }
        }
    }
    
    checkWriting() {
        // 先停止正在播放的所有音频
        if (this.audio && !this.audio.paused) {
            this.audio.pause();
            this.audio.currentTime = 0;
        }
        // 如果浏览器正在播放语音，也停止它
        if (window.speechSynthesis && window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
        }
        
        const currentChar = this.characters[this.currentIndex].character;
        // 检查是否有书写内容
        if (this.strokes.length === 0) {
            const message = '还没有写字呢！';
            const subMessage = '请在田字格中写一写这个汉字吧！';
            this.showPopup(false, message, subMessage);
            this.speakFeedback('请在田字格中写一写这个汉字吧');
            return;
        }
        
        // 获取当前汉字的标准笔画数
        const expectedStrokes = this.strokesDatabase[currentChar] || 0;
        const actualStrokes = this.strokes.length;
        
        let isCorrect = false;
        let message = '';
        let subMessage = '';
        let feedbackType = 'incorrect';
        
        // 比较笔画数 - 修改判断逻辑，更严格地判断正确性
        if (expectedStrokes === 0) {
            message = this.getRandomPhrase('correct') + '！';
            subMessage = `你写了${actualStrokes}笔，继续加油！`;
            isCorrect = true;
            feedbackType = 'correct';
        } else if (actualStrokes === expectedStrokes) {
            message = this.getRandomPhrase('correct') + '！';
            subMessage = `"${currentChar}"正好是${expectedStrokes}笔，你写对了！`;
            isCorrect = true;
            feedbackType = 'correct';
        } else if (Math.abs(actualStrokes - expectedStrokes) <= 1) {
            // 在"接近"的情况下，不再算作正确
            message = this.getRandomPhrase('almost') + '！';
            subMessage = `"${currentChar}"应该是${expectedStrokes}笔，你写了${actualStrokes}笔，再仔细看看？`;
            isCorrect = false; // 改为false，不再宽松判断
            feedbackType = 'almost';
        } else if (actualStrokes < expectedStrokes) {
            message = '还差一点点！';
            subMessage = `"${currentChar}"应该是${expectedStrokes}笔，你只写了${actualStrokes}笔，再写写看？`;
            isCorrect = false;
            feedbackType = 'incorrect';
        } else {
            message = '笔画太多了！';
            subMessage = `"${currentChar}"应该是${expectedStrokes}笔，你写了${actualStrokes}笔，再试试看？`;
            isCorrect = false;
            feedbackType = 'incorrect';
        }
        
        // 显示结果并播放语音
        this.showPopup(isCorrect, message, subMessage);
        
        // 首先定义要播放的语音文本
        const speechText = isCorrect ? '太棒了写对了' : '不对哦继续加油';
        console.log(`判断结果：${isCorrect ? '正确' : '错误'}，将播放：${speechText}`);
        
        // 使用专门的函数进行语音播放，确保播放正确的语音
        this.playSpeechFeedback(isCorrect);
        
        // 如果写得正确，则标记为已学习
        if (isCorrect) {
            // 标记为已学习并更新进度
            if (!this.progress[currentChar] || !this.progress[currentChar].learned) {
                console.log(`标记汉字 "${currentChar}" 为已学习`);
                // 确保更新进度后DOM更新
                this.progress[currentChar] = { learned: true, last_reviewed: new Date().toISOString() };
                
                // 更新进度条
                this.updateProgressBar();
                
                // 发送到服务器
                this.updateProgress(currentChar, true).catch(err => {
                    console.error('保存进度失败，但界面已更新', err);
                });
            } else {
                console.log(`汉字 "${currentChar}" 已经标记为学习过了`);
            }
        }
    }

    // 添加专门的语音反馈播放函数，根据正确与否播放不同语音
    playSpeechFeedback(isCorrect) {
        // 延迟一点以确保UI已更新
        setTimeout(() => {
            // 强制根据isCorrect播放对应的固定语音
            const feedbackText = isCorrect ? '太棒了写对了' : '不对哦继续加油';
            
            console.log(`播放语音反馈：${feedbackText}`);
            
            this.speakFeedback(feedbackText).catch(error => {
                console.error('播放语音反馈失败:', error);
            });
        }, 200);
    }

    updateDisplay() {
        if (this.characters.length === 0) {
            console.error('没有汉字数据');
            return;
        }
        const currentChar = this.characters[this.currentIndex];
        // 使用更灵活的选择器，适应不同的HTML结构
        const charElement = document.querySelector('#characterDisplay .character') || document.querySelector('.character');
        const pinyinElement = document.querySelector('#characterDisplay .pinyin') || document.querySelector('.pinyin');
        
        if (charElement) charElement.textContent = currentChar.character;
        if (pinyinElement) pinyinElement.textContent = currentChar.pinyin;
        
        this.clearCanvas();
    }

    // 添加重绘所有笔画的方法
    redrawStrokes(strokes) {
        if (!strokes || strokes.length === 0) return;
        
        const originalWidth = this.ctx.lineWidth;
        const originalStyle = this.ctx.strokeStyle;
        
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 15;
        
        strokes.forEach(stroke => {
            if (stroke.length > 1) {
                this.ctx.beginPath();
                this.ctx.moveTo(stroke[0][0], stroke[0][1]);
                
                for (let i = 1; i < stroke.length; i++) {
                    this.ctx.lineTo(stroke[i][0], stroke[i][1]);
                }
                
                this.ctx.stroke();
            }
        });
        
        this.ctx.lineWidth = originalWidth;
        this.ctx.strokeStyle = originalStyle;
    }

    // 当窗口滚动时保持画布内容
    handleWindowScroll() {
        // 只有当有笔画时才需要重绘
        if (this.strokes.length > 0) {
            // 保存当前笔画
            const savedStrokes = [...this.strokes];
            
            // 重新绘制田字格
            this.drawGrid();
            
            // 重新绘制所有已保存的笔画
            this.redrawStrokes(savedStrokes);
            
            console.log('页面滚动，保持画布内容');
        }
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log("DOM加载完成，初始化应用...");
        // 检查所有重要元素是否存在
        const elements = [
            'writingCanvas',
            'learnBtn', 
            'reviewBtn', 
            'speakBtn', 
            'nextBtn', 
            'clearBtn', 
            'checkBtn'
        ];
        
        const missingElements = elements.filter(id => !document.getElementById(id));
        if (missingElements.length > 0) {
            console.error("页面缺少以下元素:", missingElements);
        } else {
            console.log("所有必要元素均已找到");
        }
        
        // 创建应用实例
        window.app = new HanziApp();
        console.log("应用初始化完成");
    } catch (error) {
        console.error("应用初始化失败:", error);
        // 显示错误给用户
        if (typeof showError === 'function') {
            showError('应用初始化失败: ' + error.message);
        }
    }
});

// 添加页面重载功能
function reloadApp() {
    console.log("重新加载应用...");
    try {
        if (window.app) {
            // 重置应用状态
            window.app = new HanziApp();
            console.log("应用重新加载完成");
            return true;
        }
    } catch (error) {
        console.error("应用重新加载失败:", error);
    }
    return false;
}

// 为调试添加全局函数
window.debugApp = function() {
    console.log("===== 应用调试信息 =====");
    if (!window.app) {
        console.error("应用未初始化");
        return false;
    }
    
    console.log("按钮状态检查:");
    const buttons = ['learnBtn', 'reviewBtn', 'speakBtn', 'nextBtn', 'clearBtn', 'checkBtn'];
    buttons.forEach(id => {
        const el = document.getElementById(id);
        console.log(`- ${id}: ${el ? '存在' : '不存在'}`);
        if (el) {
            // 测试点击事件
            console.log(`  尝试点击 ${id}`);
            el.click();
        }
    });
    
    return true;
} 