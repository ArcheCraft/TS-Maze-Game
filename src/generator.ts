import * as mazes from "./maze.ts";
import * as modules from "./module.ts";
import { Maze } from "./maze.ts";
import { Direction } from "./world.ts";
import { Position, println, randomElement } from "./utils.ts";

type Cell = {
    x: number,
    y: number
}

// Generate nodes for the given maze size 
function generateNodes(width: number, height: number) {
    function locate(cell: Cell) {
        return cell.y * width + cell.x;
    }

    function adjacent(first: Cell, second: Cell) {
        return Math.abs(first.x - second.x) + Math.abs(first.y - second.y) == 1;
    }

    const nodes = Array<Cell>(width * height);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const cell = { x, y };
            nodes[locate(cell)] = cell;
        }
    }

    let node = randomElement(nodes);
    const stack = [node];
    const maze = new Map<Cell, Array<Cell>>();

    for (const node of nodes) {
        maze.set(node, []);
    }

    while (node) {
        const neighbors = nodes.filter((other) => !maze.get(other)!.length && adjacent(node, other));
        if (neighbors.length) {
            const neighbor = randomElement(neighbors);
            maze.get(node)!.push(neighbor);
            maze.get(neighbor)!.push(node);
            stack.unshift(neighbor);
            node = neighbor;
        } else {
            stack.shift();
            node = stack[0];
        }
    }

    return maze;
}

// Generates a maze of the given size in modules and returns it
export function createMaze(width: number, height: number) {
    const maze = mazes.create(modules.size[0] * height, modules.size[1] * width);
    const nodes = generateNodes(width, height);

    for (const [node, neighbors] of nodes) {
        const directions: Direction[] = [];
        for (const neighbor of neighbors) {
            if (neighbor.x == node.x + 1) {
                directions.push(Direction.south);
            }
            if (neighbor.x == node.x - 1) {
                directions.push(Direction.north);
            }
            if (neighbor.y == node.y - 1) {
                directions.push(Direction.west);
            }
            if (neighbor.y == node.y + 1) {
                directions.push(Direction.east);
            }
        }
        createModule(maze, node, directions, node.x == 0 && node.y == 0, node.x == height - 1 && node.y == width - 1);
    }

    return maze;
}

// Find a module for the given directions and add it to the maze
function createModule(maze: Maze, node: Cell, directions: Direction[], isStart: boolean, isEnd: boolean) {
    const possible = modules.filterModules(modules.modules, directions);
    if (possible.length == 0) {
        println("Failed to find module for directions [" + directions.map(Direction.toString) + "]");
    }
    const module = randomElement(possible);

    // Add tiles
    const offset = [node.x * modules.size[0], node.y * modules.size[1]];
    for (let x = 0; x < modules.size[0]; x++) {
        for (let y = 0; y < modules.size[1]; y++) {
            maze.set(offset[0] + x, offset[1] + y, module.maze[x][y]);
        }
    }

    // Add enemies
    for (const entry of module.enemies) {
        maze.enemies.push({
            pos: [offset[0] + entry.pos[0], offset[1] + entry.pos[1]],
            type: entry.type
        });
    }

    // Set goal and start
    let goalPos = new Position(offset[0] + module.goalPos[0], offset[1] + module.goalPos[1]);
    if (isStart) {
        maze.start = goalPos;
    }
    if (isEnd) {
        maze.end = goalPos;
    }
}
