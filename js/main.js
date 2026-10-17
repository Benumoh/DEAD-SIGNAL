import { Game } from './game.js';
import { TouchControls } from './touch.js';

const game = new Game(document.querySelector('#game'));
game.touch = new TouchControls(game);

game.start();
