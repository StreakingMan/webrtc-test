// 游戏状态
const gameState = {
    local: {
        x: 50,
        y: 50,
        color: '#ff0000'
    },
    remote: {
        x: 350,
        y: 350,
        color: '#0000ff'
    }
};

// 初始化画布
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const SQUARE_SIZE = 30;
const MOVE_SPEED = 5;

// 初始化PeerJS
const peer = new Peer({
    host: 'peerjs-server.herokuapp.com',
    secure: true,
    port: 443,
    debug: 2
});

let connection = null;

// PeerJS 连接事件
peer.on('open', (id) => {
    document.getElementById('myId').textContent = id;
    document.getElementById('status').textContent = '已连接到服务器，等待对方加入...';
});

peer.on('connection', (conn) => {
    connection = conn;
    setupConnection();
    document.getElementById('status').textContent = '对方已连接！';
});

// 连接到对方
function connectToPeer() {
    const peerId = document.getElementById('peerId').value;
    connection = peer.connect(peerId);
    setupConnection();
}

// 设置连接
function setupConnection() {
    connection.on('open', () => {
        document.getElementById('status').textContent = '连接成功！';
    });

    connection.on('data', (data) => {
        gameState.remote.x = data.x;
        gameState.remote.y = data.y;
    });
}

// 键盘控制
document.addEventListener('keydown', (e) => {
    if (!connection) return;

    switch(e.key) {
        case 'ArrowUp':
            gameState.local.y = Math.max(0, gameState.local.y - MOVE_SPEED);
            break;
        case 'ArrowDown':
            gameState.local.y = Math.min(canvas.height - SQUARE_SIZE, gameState.local.y + MOVE_SPEED);
            break;
        case 'ArrowLeft':
            gameState.local.x = Math.max(0, gameState.local.x - MOVE_SPEED);
            break;
        case 'ArrowRight':
            gameState.local.x = Math.min(canvas.width - SQUARE_SIZE, gameState.local.x + MOVE_SPEED);
            break;
    }

    // 发送位置到对方
    connection.send({
        x: gameState.local.x,
        y: gameState.local.y
    });
});

// 游戏循环
function gameLoop() {
    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制本地方块
    ctx.fillStyle = gameState.local.color;
    ctx.fillRect(gameState.local.x, gameState.local.y, SQUARE_SIZE, SQUARE_SIZE);

    // 绘制远程方块
    ctx.fillStyle = gameState.remote.color;
    ctx.fillRect(gameState.remote.x, gameState.remote.y, SQUARE_SIZE, SQUARE_SIZE);

    requestAnimationFrame(gameLoop);
}

// 启动游戏循环
gameLoop(); 