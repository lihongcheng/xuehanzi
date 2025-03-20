from flask import Flask, render_template, request, jsonify, send_file, send_from_directory
import sqlite3
import requests
import os
from datetime import datetime
import json
import logging
import hashlib

# 设置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

# 确保音频缓存目录存在
AUDIO_CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'audio_cache')
os.makedirs(AUDIO_CACHE_DIR, exist_ok=True)

# 确保数据库目录存在
DB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
os.makedirs(DB_DIR, exist_ok=True)

# 初始化数据库
def init_db():
    conn = sqlite3.connect(os.path.join(DB_DIR, 'progress.db'))
    cursor = conn.cursor()
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS progress (
        character TEXT PRIMARY KEY,
        learned BOOLEAN,
        last_reviewed TIMESTAMP
    )
    ''')
    conn.commit()
    conn.close()

# 百度API设置
# 这里应该从环境变量或配置文件中读取
BAIDU_API_KEY = 'XXX'
BAIDU_SECRET_KEY = 'XXX'

def get_baidu_token():
    """获取百度API访问令牌"""
    try:
        token_url = "https://aip.baidubce.com/oauth/2.0/token"
        params = {
            "grant_type": "client_credentials",
            "client_id": BAIDU_API_KEY,
            "client_secret": BAIDU_SECRET_KEY
        }
        response = requests.post(token_url, params=params)
        if response.status_code == 200:
            return response.json().get("access_token")
        else:
            logger.error(f"百度API令牌获取失败: {response.text}")
            return None
    except Exception as e:
        logger.error(f"获取百度令牌出错: {str(e)}")
        return None

# 网页路由
@app.route('/')
def index():
    return render_template('index.html')

# API路由
@app.route('/api/characters')
def get_characters():
    try:
        with open('characters.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
        return jsonify(data)
    except Exception as e:
        logger.error(f"加载汉字数据出错: {str(e)}")
        # 返回一些默认数据
        return jsonify({
            "characters": [
                {"character": "一", "pinyin": "yī"},
                {"character": "二", "pinyin": "èr"},
                {"character": "三", "pinyin": "sān"}
            ]
        })

@app.route('/api/progress', methods=['GET'])
def get_progress():
    try:
        init_db()
        conn = sqlite3.connect(os.path.join(DB_DIR, 'progress.db'))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM progress')
        rows = cursor.fetchall()
        conn.close()
        
        progress = {}
        for row in rows:
            progress[row['character']] = {
                'learned': bool(row['learned']),
                'last_reviewed': row['last_reviewed']
            }
        
        logger.info(f"获取进度成功, 总共 {len(progress)} 条记录")
        return jsonify(progress)
    except Exception as e:
        logger.error(f"获取进度出错: {str(e)}")
        return jsonify({})

@app.route('/api/progress', methods=['POST'])
def update_progress():
    try:
        data = request.json
        character = data.get('character')
        learned = data.get('learned', False)
        
        if not character:
            return jsonify({'error': '缺少汉字参数'}), 400
            
        init_db()
        conn = sqlite3.connect(os.path.join(DB_DIR, 'progress.db'))
        cursor = conn.cursor()
        cursor.execute(
            'INSERT OR REPLACE INTO progress (character, learned, last_reviewed) VALUES (?, ?, ?)',
            (character, learned, datetime.now().isoformat())
        )
        conn.commit()
        conn.close()
        
        logger.info(f"更新进度成功: {character}, learned={learned}")
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"更新进度出错: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/tts')
def text_to_speech():
    text = request.args.get('text', '')
    skip_cache = request.args.get('skip_cache', False) == 'true'
    
    if not text:
        return jsonify({'error': '缺少文本参数'}), 400
    
    try:
        # 使用MD5哈希值代替直接文本命名，避免特殊字符问题
        text_hash = hashlib.md5(text.encode('utf-8')).hexdigest()
        cache_filename = os.path.join(AUDIO_CACHE_DIR, f"{text_hash}.mp3")
        
        # 记录缓存路径和文本内容的映射，方便调试
        logger.info(f"尝试获取音频: '{text}' -> 缓存路径: {cache_filename}")
        
        # 检查缓存
        if not skip_cache and os.path.exists(cache_filename):
            logger.info(f"从缓存返回音频: '{text}'")
            response = send_file(cache_filename, mimetype='audio/mp3')
            # 添加no-cache头，避免浏览器缓存
            response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
            response.headers['Pragma'] = 'no-cache'
            response.headers['Expires'] = '0'
            return response
        
        # 调用百度API
        token = get_baidu_token()
        if not token:
            logger.warning("未能获取百度API令牌，使用备选方案")
            return jsonify({'error': '语音服务暂不可用'}), 503
        
        url = "https://tsn.baidu.com/text2audio"
        params = {
            'tex': text,
            'tok': token,
            'cuid': 'hanzi_app',
            'ctp': 1,
            'lan': 'zh',
            'spd': 4,  # 语速，可选0-15
            'pit': 5,  # 音调，可选0-15
            'vol': 15,  # 音量，可选0-15
            'per': 4,   # 发音人, 4:情感女声
            'aue': 3    # 音频格式，3:mp3格式
        }
        
        logger.info(f"请求百度语音API: '{text}'")
        response = requests.get(url, params=params, stream=True)
        
        if response.headers.get('Content-Type') == 'audio/mp3':
            # 保存到缓存
            with open(cache_filename, 'wb') as f:
                for chunk in response.iter_content(chunk_size=1024):
                    if chunk:
                        f.write(chunk)
            
            logger.info(f"生成音频成功: '{text}'")
            response = send_file(cache_filename, mimetype='audio/mp3')
            # 添加no-cache头，避免浏览器缓存
            response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
            response.headers['Pragma'] = 'no-cache'
            response.headers['Expires'] = '0'
            return response
        else:
            logger.error(f"百度语音合成失败: {response.text}")
            return jsonify({'error': '语音生成失败'}), 500
    
    except Exception as e:
        logger.error(f"文本转语音出错: {str(e)}")
        return jsonify({'error': str(e)}), 500

# 提供静态文件，例如favicon.ico
@app.route('/favicon.ico')
def favicon():
    return send_from_directory(os.path.join(app.root_path, 'static'),
                              'favicon.ico', mimetype='image/vnd.microsoft.icon')

if __name__ == '__main__':
    init_db()
    app.run(debug=True, host='0.0.0.0', port=5000) 