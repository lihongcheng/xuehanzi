# 学汉字 (Learn Chinese Characters)

一个专为儿童设计的汉字学习Web应用，帮助孩子们轻松学习中文汉字的读写。

## 功能特点

- 学习模式和复习模式
- 田字格书写练习
- 笔画数检查和校验
- 语音朗读功能
- 学习进度跟踪
- 针对儿童的友好界面
- 移动设备友好的响应式设计

## 包含汉字

应用包含100多个常用简体汉字，按照难度分为两个级别：
- 级别1：基础简单汉字（如一、二、三、人、口等）
- 级别2：稍复杂的汉字（如爱、猫、狗、花、草等）

## 技术栈

- 后端：Python + Flask
- 前端：HTML + CSS + JavaScript
- 数据库：SQLite
- 语音API：百度语音合成API

## 安装步骤

### 前提条件

- Python 3.6+
- pip（Python包管理器）

### 安装流程

1. 克隆仓库
```bash
git clone https://github.com/yourusername/xuehanzi.git
cd xuehanzi
```

2. 安装依赖
```bash
pip install -r requirements.txt
```

3. 运行应用
```bash
python run.py
```

应用将自动创建必要的数据库和缓存目录，并在本地运行一个Web服务器（默认端口5000）。

## 使用方法

1. 打开浏览器，访问 `http://localhost:5000`
2. 选择"学习模式"或"复习模式"
3. 在田字格中书写显示的汉字
4. 点击"检查"按钮查看书写是否正确
5. 使用"下一个"按钮切换到下一个汉字

## 自定义设置

- 汉字数据存储在 `characters.json` 文件中，您可以按需添加或修改
- 语音API密钥和秘钥需在 `app.py` 中配置

## 许可证

本项目采用MIT许可证。请参阅项目中的LICENSE文件了解详情。

## 贡献指南

欢迎贡献代码、报告问题或提出改进建议！请通过以下方式参与：

1. Fork本仓库
2. 创建您的特性分支：`git checkout -b feature/AmazingFeature`
3. 提交您的更改：`git commit -m 'Add some AmazingFeature'`
4. 推送到分支：`git push origin feature/AmazingFeature`
5. 打开Pull Request 