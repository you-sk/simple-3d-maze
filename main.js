const MAZE_WIDTH = 31;
const MAZE_HEIGHT = 21;
const WALL_HEIGHT = 5;
const CELL_SIZE = 10;

let scene, camera, renderer;
let maze = [];
let discoveredMaze = [];

let playerX = 1;
let playerY = 1;
let playerRotation = 0; // 0: North, 1: East, 2: South, 3: West

let isMoving = false;

const mapCanvas = document.getElementById('map-2d');
const mapCtx = mapCanvas.getContext('2d');

function init() {
    // 3D Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);

    // Camera (Player)
    camera = new THREE.PerspectiveCamera(75, (window.innerWidth * 0.6) / 600, 0.1, 1000);
    updateCameraPosition();

    // Renderer
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth * 0.6, 600);
    document.getElementById('view-3d').appendChild(renderer.domElement);

    // Floor
    const floorGeometry = new THREE.PlaneGeometry(MAZE_WIDTH * CELL_SIZE, MAZE_HEIGHT * CELL_SIZE);
    const floorMaterial = new THREE.MeshBasicMaterial({ color: 0xcccccc, side: THREE.DoubleSide });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = Math.PI / 2;
    floor.position.set((MAZE_WIDTH / 2) * CELL_SIZE, 0, (MAZE_HEIGHT / 2) * CELL_SIZE);
    scene.add(floor);

    // Maze Generation
    generateMaze();

    // Draw Maze
    drawMaze();

    // Goal
    const goalGeometry = new THREE.BoxGeometry(CELL_SIZE / 2, CELL_SIZE / 2, CELL_SIZE / 2);
    const goalMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const goal = new THREE.Mesh(goalGeometry, goalMaterial);
    goal.position.set((MAZE_WIDTH - 2) * CELL_SIZE + CELL_SIZE / 2, WALL_HEIGHT / 2, (MAZE_HEIGHT - 2) * CELL_SIZE + CELL_SIZE / 2);
    scene.add(goal);

    // 2D Map
    init2DMap();

    // Event Listeners
    document.addEventListener('keydown', handleKeyDown);
    document.getElementById('restart-button').addEventListener('click', restartGame);

    // Game Loop
    animate();
}

function generateMaze() {
    for (let y = 0; y < MAZE_HEIGHT; y++) {
        maze[y] = [];
        for (let x = 0; x < MAZE_WIDTH; x++) {
            maze[y][x] = 1;
        }
    }
    const stack = [];
    let currentX = 1;
    let currentY = 1;
    maze[currentY][currentX] = 0;
    stack.push([currentX, currentY]);
    while (stack.length > 0) {
        const [cx, cy] = stack[stack.length - 1];
        const neighbors = [];
        if (cx > 1 && maze[cy][cx - 2] === 1) neighbors.push([cx - 2, cy, cx - 1, cy]);
        if (cx < MAZE_WIDTH - 2 && maze[cy][cx + 2] === 1) neighbors.push([cx + 2, cy, cx + 1, cy]);
        if (cy > 1 && maze[cy - 2][cx] === 1) neighbors.push([cx, cy - 2, cx, cy - 1]);
        if (cy < MAZE_HEIGHT - 2 && maze[cy + 2][cx] === 1) neighbors.push([cx, cy + 2, cx, cy + 1]);
        if (neighbors.length > 0) {
            const [nx, ny, wx, wy] = neighbors[Math.floor(Math.random() * neighbors.length)];
            maze[ny][nx] = 0;
            maze[wy][wx] = 0;
            stack.push([nx, ny]);
        } else {
            stack.pop();
        }
    }
    for (let y = 0; y < MAZE_HEIGHT; y++) {
        discoveredMaze[y] = [];
        for (let x = 0; x < MAZE_WIDTH; x++) {
            discoveredMaze[y][x] = -1;
        }
    }
}

function drawMaze() {
    const wallGeometry = new THREE.BoxGeometry(CELL_SIZE, WALL_HEIGHT, CELL_SIZE);
    const wallMaterial = new THREE.MeshBasicMaterial({ color: 0xaaaaaa });

    const edgesGeometry = new THREE.EdgesGeometry(wallGeometry);
    const edgesMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });

    for (let y = 0; y < MAZE_HEIGHT; y++) {
        for (let x = 0; x < MAZE_WIDTH; x++) {
            if (maze[y][x] === 1) {
                const wall = new THREE.Mesh(wallGeometry, wallMaterial);
                wall.position.set(x * CELL_SIZE + CELL_SIZE / 2, WALL_HEIGHT / 2, y * CELL_SIZE + CELL_SIZE / 2);
                scene.add(wall);

                const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
                edges.position.copy(wall.position);
                scene.add(edges);
            }
        }
    }
}

function init2DMap() {
    mapCanvas.width = mapCanvas.offsetWidth;
    mapCanvas.height = mapCanvas.offsetHeight;
    mapCtx.fillStyle = 'black';
    mapCtx.fillRect(0, 0, mapCanvas.width, mapCanvas.height);
}

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

function handleKeyDown(e) {
    if (isMoving) return;

    let targetX = playerX;
    let targetY = playerY;
    let targetRotation = playerRotation;

    switch (e.key) {
        case 'w':
            if (playerRotation === 0) targetY--;
            if (playerRotation === 1) targetX++;
            if (playerRotation === 2) targetY++;
            if (playerRotation === 3) targetX--;
            break;
        case 's':
            if (playerRotation === 0) targetY++;
            if (playerRotation === 1) targetX--;
            if (playerRotation === 2) targetY--;
            if (playerRotation === 3) targetX++;
            break;
        case 'a':
            targetRotation = (playerRotation + 3) % 4;
            break;
        case 'd':
            targetRotation = (playerRotation + 1) % 4;
            break;
        default:
            return;
    }

    if (maze[targetY] && maze[targetY][targetX] === 0) {
        playerX = targetX;
        playerY = targetY;
    }

    playerRotation = targetRotation;
    
    isMoving = true;
    const startPosition = camera.position.clone();
    const endPosition = new THREE.Vector3(playerX * CELL_SIZE + CELL_SIZE / 2, WALL_HEIGHT / 2, playerY * CELL_SIZE + CELL_SIZE / 2);
    const startQuaternion = camera.quaternion.clone();
    const endQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -playerRotation * Math.PI / 2, 0, 'YXZ'));

    let startTime = null;
    function moveAnimation(timestamp) {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / 200, 1);

        camera.position.lerpVectors(startPosition, endPosition, progress);
        camera.quaternion.slerpQuaternions(startQuaternion, endQuaternion, progress);

        if (progress < 1) {
            requestAnimationFrame(moveAnimation);
        } else {
            isMoving = false;
            update2DMap();
            checkGoal();
        }
    }
    requestAnimationFrame(moveAnimation);
}

function updateCameraPosition() {
    camera.position.set(playerX * CELL_SIZE + CELL_SIZE / 2, WALL_HEIGHT / 2, playerY * CELL_SIZE + CELL_SIZE / 2);
    camera.quaternion.setFromEuler(new THREE.Euler(0, -playerRotation * Math.PI / 2, 0, 'YXZ'));
}

function update2DMap() {
    if (discoveredMaze[playerY][playerX] === -1) {
        discoveredMaze[playerY][playerX] = maze[playerY][playerX];
    }
    for (let y = -1; y <= 1; y++) {
        for (let x = -1; x <= 1; x++) {
            const checkX = playerX + x;
            const checkY = playerY + y;
            if (checkX >= 0 && checkX < MAZE_WIDTH && checkY >= 0 && checkY < MAZE_HEIGHT) {
                if (discoveredMaze[checkY][checkX] === -1) {
                    discoveredMaze[checkY][checkX] = maze[checkY][checkX];
                }
            }
        }
    }
    draw2DMap();
}

function draw2DMap() {
    const cellWidth = mapCanvas.width / MAZE_WIDTH;
    const cellHeight = mapCanvas.height / MAZE_HEIGHT;
    mapCtx.fillStyle = 'black';
    mapCtx.fillRect(0, 0, mapCanvas.width, mapCanvas.height);
    for (let y = 0; y < MAZE_HEIGHT; y++) {
        for (let x = 0; x < MAZE_WIDTH; x++) {
            if (discoveredMaze[y][x] === 0) {
                mapCtx.fillStyle = 'white';
                mapCtx.fillRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);
            } else if (discoveredMaze[y][x] === 1) {
                mapCtx.fillStyle = '#555';
                mapCtx.fillRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);
                mapCtx.strokeStyle = '#444';
                mapCtx.strokeRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);
            }
        }
    }
    mapCtx.fillStyle = 'red';
    mapCtx.save();
    mapCtx.translate(playerX * cellWidth + cellWidth / 2, playerY * cellHeight + cellHeight / 2);
    mapCtx.rotate(playerRotation * Math.PI / 2);
    mapCtx.beginPath();
    mapCtx.moveTo(0, -cellHeight / 3);
    mapCtx.lineTo(-cellWidth / 4, cellHeight / 3);
    mapCtx.lineTo(cellWidth / 4, cellHeight / 3);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.restore();
}

function checkGoal() {
    if (playerX === MAZE_WIDTH - 2 && playerY === MAZE_HEIGHT - 2) {
        document.getElementById('goal-modal').style.display = 'block';
    }
}

function restartGame() {
    document.getElementById('goal-modal').style.display = 'none';
    playerX = 1;
    playerY = 1;
    playerRotation = 0;
    updateCameraPosition();
    generateMaze();
    while(scene.children.length > 0){ 
        scene.remove(scene.children[0]); 
    }
    drawMaze();
    const goalGeometry = new THREE.BoxGeometry(CELL_SIZE / 2, CELL_SIZE / 2, CELL_SIZE / 2);
    const goalMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const goal = new THREE.Mesh(goalGeometry, goalMaterial);
    goal.position.set((MAZE_WIDTH - 2) * CELL_SIZE + CELL_SIZE / 2, WALL_HEIGHT / 2, (MAZE_HEIGHT - 2) * CELL_SIZE + CELL_SIZE / 2);
    scene.add(goal);
    const floorGeometry = new THREE.PlaneGeometry(MAZE_WIDTH * CELL_SIZE, MAZE_HEIGHT * CELL_SIZE);
    const floorMaterial = new THREE.MeshBasicMaterial({ color: 0xcccccc, side: THREE.DoubleSide });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = Math.PI / 2;
    floor.position.set((MAZE_WIDTH / 2) * CELL_SIZE, 0, (MAZE_HEIGHT / 2) * CELL_SIZE);
    scene.add(floor);
    init2DMap();
}

init();