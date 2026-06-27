# 动漫角色抢答赛联机版

这是可以部署到云端的版本。服务器负责房间、玩家身份、倒计时、计分、自动下一轮和房间同步。

## 本地运行

```bash
npm start
```

打开 `http://localhost:3000`。

## 部署到 Render

1. 把这个文件夹上传到 GitHub 仓库。
2. 打开 Render，创建 `Web Service`。
3. 选择你的 GitHub 仓库。
4. Start Command 填：

```bash
npm start
```

5. 部署完成后，把 Render 给你的 `https://...onrender.com` 链接发给同学。

## 注意

这个版本的房间数据存在服务器内存里。免费云服务休眠或重启后，正在玩的房间会清空。
