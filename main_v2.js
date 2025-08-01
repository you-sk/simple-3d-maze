const MAZE_WIDTH = 31;
const MAZE_HEIGHT = 21;
const WALL_HEIGHT = 5;
const CELL_SIZE = 10;
const NUM_GEMS = 3;

let scene, camera, renderer;
let maze = [];
let discoveredMaze = [];
let gems = [];
let pointLight;

let playerX = 1;
let playerY = 1;
let playerRotation = 0;

let collectedGems = 0;
let startTime, elapsedTime, timerInterval;
let bestTime = localStorage.getItem('bestTime') || Infinity;

let isMoving = false;
let totalExploredCells = 0;

const mapCanvas = document.getElementById('map-2d');
const mapCtx = mapCanvas.getContext('2d');
const gemCounter = document.getElementById('gem-counter');
const timerDisplay = document.getElementById('timer');
const bestTimeDisplay = document.getElementById('best-time'); // Corrected line

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue background

    camera = new THREE.PerspectiveCamera(75, (window.innerWidth * 0.6) / 600, 0.1, 1000);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth * 0.6, 600);
    document.getElementById('view-3d').appendChild(renderer.domElement);

    document.getElementById('restart-button').addEventListener('click', restartGame);
    document.addEventListener('keydown', handleKeyDown);

    updateBestTimeDisplay();
    startGame();
    animate();
}

function startGame() {
    playerX = 1;
    playerY = 1;
    playerRotation = 0;
    collectedGems = 0;
    updateGemCounter();

    while(scene.children.length > 0){
        scene.remove(scene.children[0]);
    }

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Original intensity
    scene.add(ambientLight);
    pointLight = new THREE.PointLight(0xffffff, 1, 50); // Original intensity
    scene.add(pointLight);

    const floorGeometry = new THREE.PlaneGeometry(MAZE_WIDTH * CELL_SIZE, MAZE_HEIGHT * CELL_SIZE);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xAAAAAA, roughness: 0.8, side: THREE.DoubleSide }); // Grey floor, StandardMaterial
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = Math.PI / 2;
    floor.position.set((MAZE_WIDTH / 2) * CELL_SIZE, 0, (MAZE_HEIGHT / 2) * CELL_SIZE);
    scene.add(floor);

    // Ceiling object removed as per user's request to use background color for sky

    generateMaze();
    drawMaze();
    placeGems();

    const goalGeometry = new THREE.BoxGeometry(CELL_SIZE / 2, CELL_SIZE / 2, CELL_SIZE / 2);
    const goalMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const goal = new THREE.Mesh(goalGeometry, goalMaterial);
    goal.position.set((MAZE_WIDTH - 2) * CELL_SIZE + CELL_SIZE / 2, WALL_HEIGHT / 2, (MAZE_HEIGHT - 2) * CELL_SIZE + CELL_SIZE / 2);
    scene.add(goal);

    init2DMap();
    updateCameraPosition();
    startTimer();
}

function generateMaze() {
    for (let y = 0; y < MAZE_HEIGHT; y++) {
        maze[y] = [];
        discoveredMaze[y] = [];
        for (let x = 0; x < MAZE_WIDTH; x++) {
            maze[y][x] = 1;
            discoveredMaze[y][x] = -1;
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
    const loops = Math.floor((MAZE_WIDTH * MAZE_HEIGHT) / 15);
    for (let i = 0; i < loops; i++) {
        const x = Math.floor(Math.random() * (MAZE_WIDTH - 2)) + 1;
        const y = Math.floor(Math.random() * (MAZE_HEIGHT - 2)) + 1;
        if (maze[y][x] === 1) {
            maze[y][x] = 0;
        }
    }
}

function drawMaze() {
    const wallGeometry = new THREE.BoxGeometry(CELL_SIZE, WALL_HEIGHT, CELL_SIZE);
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.9 });
    const edgesGeometry = new THREE.EdgesGeometry(wallGeometry);
    const edgesMaterial = new THREE.LineBasicMaterial({ color: 0x222222 });

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

function placeGems() {
    gems = [];
    const gemGeometry = new THREE.IcosahedronGeometry(CELL_SIZE / 3, 0);
    const gemMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xff0000, // Ruby red
        transparent: true,
        opacity: 0.9,
        roughness: 0.1,
        metalness: 0.3,
        transmission: 0.8,
        clearcoat: 1.0
    });

    for (let i = 0; i < NUM_GEMS; i++) {
        let x, y;
        do {
            x = Math.floor(Math.random() * (MAZE_WIDTH - 2)) + 1;
            y = Math.floor(Math.random() * (MAZE_HEIGHT - 2)) + 1;
        } while (maze[y][x] !== 0 || (x === 1 && y === 1) || (x === MAZE_WIDTH - 2 && y === MAZE_HEIGHT - 2));

        const gem = new THREE.Mesh(gemGeometry, gemMaterial);
        gem.position.set(x * CELL_SIZE + CELL_SIZE / 2, WALL_HEIGHT / 2, y * CELL_SIZE + CELL_SIZE / 2);
        gem.userData = { x, y };
        gems.push(gem);
        scene.add(gem);
    }
}

function init2DMap() {
    const mapContainer = mapCanvas.parentElement;
    const computedStyle = window.getComputedStyle(mapContainer);
    const containerHeight = mapContainer.clientHeight - 
                          parseInt(computedStyle.paddingTop) - 
                          parseInt(computedStyle.paddingBottom);
    
    // Calculate available height for canvas
    const headerHeight = document.getElementById('map-header').offsetHeight;
    const statsHeight = document.getElementById('map-stats').offsetHeight;
    const availableHeight = containerHeight - headerHeight - statsHeight;
    
    mapCanvas.width = mapCanvas.offsetWidth;
    mapCanvas.height = availableHeight;
    update2DMap();
}

function animate() {
    requestAnimationFrame(animate);
    gems.forEach(gem => {
        gem.rotation.y += 0.02;
    });
    renderer.render(scene, camera);
}

function handleKeyDown(e) {
    if (isMoving) return;

    let targetX = playerX;
    let targetY = playerY;
    let targetRotation = playerRotation;

    switch (e.key) {
        case 'w': case 'ArrowUp':
            if (playerRotation === 0) targetY--;
            if (playerRotation === 1) targetX++;
            if (playerRotation === 2) targetY++;
            if (playerRotation === 3) targetX--;
            break;
        case 's': case 'ArrowDown':
            if (playerRotation === 0) targetY++;
            if (playerRotation === 1) targetX--;
            if (playerRotation === 2) targetY--;
            if (playerRotation === 3) targetX++;
            break;
        case 'a': case 'ArrowLeft':
            targetRotation = (playerRotation + 3) % 4;
            break;
        case 'd': case 'ArrowRight':
            targetRotation = (playerRotation + 1) % 4;
            break;
        default: return;
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
            checkGemCollection();
            update2DMap();
            checkGoal();
        }
    }
    requestAnimationFrame(moveAnimation);
}

function updateCameraPosition() {
    camera.position.set(playerX * CELL_SIZE + CELL_SIZE / 2, WALL_HEIGHT / 2, playerY * CELL_SIZE + CELL_SIZE / 2);
    camera.quaternion.setFromEuler(new THREE.Euler(0, -playerRotation * Math.PI / 2, 0, 'YXZ'));
    pointLight.position.copy(camera.position);
}

function update2DMap() {
    const cellSize = Math.min(mapCanvas.width / MAZE_WIDTH, mapCanvas.height / MAZE_HEIGHT);
    const offsetX = (mapCanvas.width - cellSize * MAZE_WIDTH) / 2;
    const offsetY = (mapCanvas.height - cellSize * MAZE_HEIGHT) / 2;
    
    mapCtx.fillStyle = 'black';
    mapCtx.fillRect(0, 0, mapCanvas.width, mapCanvas.height);

    // Discover current cell
    if (discoveredMaze[playerY][playerX] === -1) {
        discoveredMaze[playerY][playerX] = maze[playerY][playerX];
    }

    // Discover adjacent cells
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

    for (let y = 0; y < MAZE_HEIGHT; y++) {
        for (let x = 0; x < MAZE_WIDTH; x++) {
            if (discoveredMaze[y][x] === 0) {
                mapCtx.fillStyle = 'white';
                mapCtx.fillRect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize, cellSize);
            } else if (discoveredMaze[y][x] === 1) {
                mapCtx.fillStyle = '#555';
                mapCtx.fillRect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize, cellSize);
                mapCtx.strokeStyle = '#444';
                mapCtx.strokeRect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize, cellSize);
            }
        }
    }

    mapCtx.font = `bold ${cellSize * 1.2}px sans-serif`;
    mapCtx.textAlign = 'center';
    mapCtx.textBaseline = 'middle';
    mapCtx.fillStyle = '#33aaff';
    mapCtx.fillText('S', offsetX + 1.5 * cellSize, offsetY + 1.5 * cellSize);
    mapCtx.fillStyle = '#ff33aa';
    mapCtx.fillText('G', offsetX + (MAZE_WIDTH - 1.5) * cellSize, offsetY + (MAZE_HEIGHT - 1.5) * cellSize);

    mapCtx.fillStyle = 'red';
    mapCtx.save();
    mapCtx.translate(offsetX + playerX * cellSize + cellSize / 2, offsetY + playerY * cellSize + cellSize / 2);
    mapCtx.rotate(playerRotation * Math.PI / 2);
    mapCtx.beginPath();
    mapCtx.moveTo(0, -cellSize / 3);
    mapCtx.lineTo(-cellSize / 4, cellSize / 3);
    mapCtx.lineTo(cellSize / 4, cellSize / 3);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.restore();
    
    updateMapStats();
}

function updateMapStats() {
    // Update position
    document.getElementById('position').textContent = `X: ${playerX}, Y: ${playerY}`;
    
    // Calculate explored percentage
    let exploredCount = 0;
    let totalTraversable = 0;
    for (let y = 0; y < MAZE_HEIGHT; y++) {
        for (let x = 0; x < MAZE_WIDTH; x++) {
            if (maze[y][x] === 0) {
                totalTraversable++;
                if (discoveredMaze[y][x] !== -1) {
                    exploredCount++;
                }
            }
        }
    }
    const exploredPercentage = Math.round((exploredCount / totalTraversable) * 100);
    document.getElementById('explored').textContent = `${exploredPercentage}%`;
    
    // Calculate distance to goal
    const distance = Math.abs(playerX - (MAZE_WIDTH - 2)) + Math.abs(playerY - (MAZE_HEIGHT - 2));
    document.getElementById('distance').textContent = distance;
}

function checkGemCollection() {
    gems.forEach((gem, index) => {
        if (playerX === gem.userData.x && playerY === gem.userData.y) {
            scene.remove(gem);
            gems.splice(index, 1);
            collectedGems++;
            updateGemCounter();
        }
    });
}

function updateGemCounter() {
    gemCounter.textContent = `Gems: ${collectedGems}/${NUM_GEMS}`;
}

function checkGoal() {
    if (playerX === MAZE_WIDTH - 2 && playerY === MAZE_HEIGHT - 2) {
        if (collectedGems === NUM_GEMS) {
            stopTimer();
            const newBestTime = elapsedTime < bestTime;
            if (newBestTime) {
                bestTime = elapsedTime;
                localStorage.setItem('bestTime', bestTime);
                updateBestTimeDisplay();
            }
            showGoalModal(newBestTime);
        }
    }
}

function showGoalModal(isNewRecord) {
    const modalTitle = document.getElementById('modal-title');
    const modalTime = document.getElementById('modal-time');
    const modalBestTime = document.getElementById('modal-best-time');

    modalTitle.textContent = isNewRecord ? "New Record!" : "Goal!";
    modalTime.textContent = `Time: ${formatTime(elapsedTime)}`;
    modalBestTime.textContent = `Best: ${formatTime(bestTime)}`;
    document.getElementById('goal-modal').style.display = 'block';
}

function restartGame() {
    document.getElementById('goal-modal').style.display = 'none';
    startGame();
}

function startTimer() {
    startTime = Date.now();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        elapsedTime = Date.now() - startTime;
        timerDisplay.textContent = `Time: ${formatTime(elapsedTime)}`;
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}

function formatTime(ms) {
    if (ms === Infinity) return "--:--";
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function updateBestTimeDisplay() {
    bestTimeDisplay.textContent = `Best: ${formatTime(bestTime)}`;
}

init();