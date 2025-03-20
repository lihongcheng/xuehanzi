# 儿童学汉字应用启动脚本

import os
import sys
import webbrowser
import threading
import time

def open_browser():
    """延迟3秒后打开浏览器"""
    time.sleep(3)
    try:
        webbrowser.open('http://localhost:5000')
        print("已在浏览器中打开应用...")
    except:
        print("无法自动打开浏览器，请手动访问 http://localhost:5000")

if __name__ == "__main__":
    print("正在启动儿童学汉字应用...")
    
    # 启动浏览器线程
    threading.Thread(target=open_browser).start()
    
    # 检查依赖项
    try:
        import flask
        import requests
    except ImportError:
        print("正在安装依赖项...")
        os.system(f"{sys.executable} -m pip install flask requests")
    
    # 创建必要的目录
    os.makedirs('data', exist_ok=True)
    
    # 启动应用
    try:
        import app
        app.app.run(debug=True, host='0.0.0.0')
    except Exception as e:
        print(f"启动失败: {e}")
        input("按任意键退出...") 