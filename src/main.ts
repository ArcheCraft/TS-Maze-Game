import * as cli from "./cli.ts";
import { println, storage, containsAll, clear, randomize, print } from "./utils.ts";
import * as maze from "./maze.ts";
import * as world from "./world.ts";
import * as enemies from "./enemies.ts";
import * as loot from "./loot.ts";
import * as modules from "./module.ts";
import * as generator from "./generator.ts";
import chalk from "chalk";
import { MenuCommand } from "./cli.ts";
import { Maze } from "./maze.ts";

// Randomize the random number generator that may on different implementations be not random
randomize();

cli.start();

// Load the .json files in their corresponding folder
loot.discover();
enemies.discover();
maze.discover();
modules.discover();
modules.check();

let res = {
    start: true,
    freeplay: false
};

storage.load();

// Prints the menu and processes user commands
function runMenu(): { cont: boolean, start: boolean, freeplay: boolean } {
    return cli.menu(function(cmd: MenuCommand) {
        if (cmd == cli.MenuCommand.start) {
            return {
                cont: false,
                start: true,
            };
        } else if (cmd == cli.MenuCommand.exit) {
            return {
                cont: false,
                start: false,
            };
        } else if (cmd == cli.MenuCommand.select) {
            // Completed levels determine what levels are available
            const completed = storage.get().completed;

            const levels: LevelPrintDef[] = [];
            const tutorials: LevelPrintDef[] = [];

            const available = {
                levels: 0,
                tutorials: 0,
            };
            for (const id in maze.mazes) {
                let level = maze.mazes[id];

                let arr = levels;
                let av = "levels";
                if (level.data.tutorial) {
                    arr = tutorials;
                    av = "tutorials";
                }

                // Definitely available if already completed
                if (completed.includes(id)) {
                    arr.push({
                        name: level.data.name,
                        done: true,
                        available: true,
                        order: level.data.order,
                        id,
                    });
                    available[av] += 1;
                    // Also available if all dependencies completed
                } else if (containsAll(level.data.dependencies, completed)) {
                    arr.push({
                        name: level.data.name,
                        available: true,
                        order: level.data.order,
                        id,
                    });
                    available[av] += 1;
                    // Otherwise not available
                } else {
                    arr.push({
                        name: level.data.name,
                        order: level.data.order,
                        id,
                    });
                }
            }

            // Sort the levels after the defined order
            let sorter = function(a: LevelPrintDef, b: LevelPrintDef) {
                return a.order.localeCompare(b.order);
            };
            levels.sort(sorter);
            tutorials.sort(sorter);

            const freeplayCount = 1;
            const tutorialCount = available.tutorials;
            const levelCount = available.levels;
            const mazeCount = freeplayCount + tutorialCount + levelCount;

            const chosen = cli.selection(mazeCount, function(index: number) {
                const width = 40;
                println("-".repeat(width));
                println(chalk.yellow(" ".repeat((width - 20) / 2) + "   LEVEL SELECTION  " + " ".repeat((width - 20) / 2)));
                println();

                let idx = 1;

                // Prints an array of levels
                function printArray(array: LevelPrintDef[]) {
                    for (const entry of array) {
                        let line = "";
                        const selected = entry.available && idx == index;

                        if (entry.available) {
                            if (selected) {
                                line += " >> ";
                            } else {
                                line += "    ";
                            }
                            idx += 1;
                        } else {
                            line += "    ";
                        }

                        let text: string;
                        if (entry.done) {
                            text = chalk.green(entry.name);
                        } else if (entry.available) {
                            text = chalk.blue(entry.name);
                        } else {
                            text = chalk.gray(entry.name);
                        }

                        if (selected) {
                            text = chalk.bold(text);
                        }
                        line += text;

                        println(line);
                    }
                }

                println(chalk.yellow("      Freeplay"));
                if (index == 0) {
                    print(" >> ");
                } else {
                    print("    ");
                }
                println(chalk.red("Freeplay"));
                println();
                println(chalk.yellow("      Tutorials"));
                printArray(tutorials);
                println();
                println(chalk.yellow("      Levels"));
                printArray(levels);

                println();
                println("-".repeat(width));
            });

            // If the user selected something
            if (chosen != -1) {
                let entry!: LevelPrintDef;
                let idx = 1;
                // If he chose freeplay, we set the freeplay trigger
                if (chosen == 0) {
                    return {
                        cont: false,
                        freeplay: true,
                        start: true
                    };
                    // Otherwise we load the selected level
                } else {
                    for (let index = 0; index < tutorialCount + levelCount; index++) {
                        if (index < tutorialCount) {
                            entry = tutorials[index];
                        } else {
                            entry = levels[index - tutorialCount];
                        }
                        if (entry.available) {
                            if (idx == chosen) {
                                break;
                            }
                            idx += 1;
                        }
                    }
                }


                // Save the current level so it gets selected automatically next time the user starts the  game
                storage.get().mazeId = entry.id;
            }
        }

        return {
            cont: true,
        };
    });
}

// Runs a maze:
// - Starts the maze
// - Processes the user's commands
// - Checks whether the player survived
function runMaze(currMaze: Maze) {
    let currWorld = world.create(currMaze);

    const cont: { restart: boolean, survived?: boolean, exited?: boolean } = cli.ingame(currWorld, function(cmd) {
        let moved = false;

        if (cmd == cli.InGameCommand.exit) {
            return {
                cont: false,
                exited: true
            };
        } else if (cmd == cli.InGameCommand.restart) {
            currWorld = world.create(currMaze);
            return {
                cont: false,
                restart: true
            };
        } else if (cmd == cli.InGameCommand.up) {
            if (!currWorld.walk(world.Direction.north)) {
                println("Illegal move!");
            } else {
                moved = true;
            }
        } else if (cmd == cli.InGameCommand.left) {
            if (!currWorld.walk(world.Direction.west)) {
                println("Illegal move!");
            } else {
                moved = true;
            }
        } else if (cmd == cli.InGameCommand.down) {
            if (!currWorld.walk(world.Direction.south)) {
                println("Illegal move!");
            } else {
                moved = true;
            }
        } else if (cmd == cli.InGameCommand.right) {
            if (!currWorld.walk(world.Direction.east)) {
                println("Illegal move!");
            } else {
                moved = true;
            }
        }

        // Don't continue if the player won or is dead
        if (currWorld.isFinished()) {
            return {
                cont: false,
                print: true
            };
        }

        return {
            cont: true,
            didMove: moved
        };
    }, function() {
        // Process enemies and tile ticks
        currWorld.enemyMove();
        currWorld.tick();

        // Don't continue if the player won or is dead
        if (currWorld.isFinished()) {
            return {
                cont: false,
                print: true
            };
        }

        return {
            cont: true
        };
    });

    cont.survived = currWorld.survived();

    return cont;
}

// Prints the result of played level
function printResult(res: { start?: boolean }, cont: { exited?: boolean, survived?: boolean }) {
    function printSep(size: number) {
        println();
        println(chalk.gray("-".repeat(size)));
        println();
    }

    // Only print if the level was started and the user didn't exit the level
    if (res.start && !cont.exited) {
        if (!cont.survived) {
            printSep(14);
            println(chalk.red.italic("YOU'RE DEAD..."));
            printSep(14);
            // If the player didn't die, he won
        } else {
            printSep(8);
            println(chalk.green.bold("YOU WON!"));
            printSep(8);

            return true;
        }
    }

    return false
}

// Generates a freeplay level and runs it
function freeplay(cont: { restart: boolean, survived?: boolean, exited?: boolean, won?: boolean }, level: number) {
    const currMaze = generator.createMaze(level + 3, level + 3);

    while (cont.restart) {
        cont = runMaze(currMaze);
    }

    cont.won = printResult(res, cont);
    cont.restart = cont.won;

    return cont;
}

type LevelPrintDef = {
    name: string,
    done?: boolean,
    available?: boolean,
    order: string,
    id: string
}

while (res.start) {
    // First check what the user wants
    res = runMenu();

    let cont: { restart: boolean, survived?: boolean, exited?: boolean, won?: boolean } = {
        restart: res.start,
        won: res.start
    };

    // If he wants freeplay, we track the level and increase it after every win
    if (res.freeplay) {
        let level = 0;

        while (cont.won) {
            level += 1;
            cont = freeplay(cont, level);
        }
        // If he selected a level, we load that level and run it
    } else {
        const currMaze = maze.mazes[storage.get().mazeId];

        while (cont.restart) {
            cont = runMaze(currMaze);
        }

        if (printResult(res, cont)) {
            // If he won, we also save the level so dependent levels are now unlocked
            const completed = storage.get().completed;
            if (!completed.includes(storage.get().mazeId)) {
                completed.push(storage.get().mazeId);
            }
        }
    }
}

storage.save();

clear.exec();
