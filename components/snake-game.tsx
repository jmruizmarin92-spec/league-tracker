"use client";

import * as React from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";

const GRID = 16;
const CELL = 24;
const SIZE = GRID * CELL;
const TICK_MS = 140;
const START_LENGTH = 3;

type Dir = "up" | "down" | "left" | "right";
type Point = { x: number; y: number };
type Phase = "idle" | "running" | "over";

const DELTA: Record<Dir, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Dir, Dir> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

const KEY_TO_DIR: Record<string, Dir> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
  W: "up",
  S: "down",
  A: "left",
  D: "right",
};

type GameState = {
  snake: Point[];
  dir: Dir;
  nextDir: Dir;
  food: Point;
};

function randomFood(snake: Point[]): Point {
  const taken = new Set(snake.map((p) => `${p.x},${p.y}`));
  const free: Point[] = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!taken.has(`${x},${y}`)) free.push({ x, y });
    }
  }
  return free[Math.floor(Math.random() * free.length)] ?? { x: 0, y: 0 };
}

function freshGame(dir: Dir): GameState {
  const mid = Math.floor(GRID / 2);
  const snake: Point[] = [];
  for (let i = 0; i < START_LENGTH; i++) {
    snake.push({ x: mid - i * DELTA[dir].x, y: mid - i * DELTA[dir].y });
  }
  return { snake, dir, nextDir: dir, food: randomFood(snake) };
}

// Advances one step. Returns null when the snake dies.
function step(g: GameState): GameState | null {
  const dir = g.nextDir;
  const head = g.snake[0];
  const next = { x: head.x + DELTA[dir].x, y: head.y + DELTA[dir].y };
  if (next.x < 0 || next.y < 0 || next.x >= GRID || next.y >= GRID) return null;
  const eats = next.x === g.food.x && next.y === g.food.y;
  // The tail cell frees up this tick unless we grow, so it is not a collision.
  const body = eats ? g.snake : g.snake.slice(0, -1);
  if (body.some((p) => p.x === next.x && p.y === next.y)) return null;
  const snake = [next, ...body];
  return { snake, dir, nextDir: dir, food: eats ? randomFood(snake) : g.food };
}

function draw(canvas: HTMLCanvasElement, g: GameState | null) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#1f2937";
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  for (let i = 1; i < GRID; i++) {
    ctx.beginPath();
    ctx.moveTo(i * CELL + 0.5, 0);
    ctx.lineTo(i * CELL + 0.5, SIZE);
    ctx.moveTo(0, i * CELL + 0.5);
    ctx.lineTo(SIZE, i * CELL + 0.5);
    ctx.stroke();
  }
  if (!g) return;
  ctx.fillStyle = "#ef4444";
  ctx.fillRect(g.food.x * CELL + 3, g.food.y * CELL + 3, CELL - 6, CELL - 6);
  g.snake.forEach((p, i) => {
    ctx.fillStyle = i === 0 ? "#86efac" : "#22c55e";
    ctx.fillRect(p.x * CELL + 1, p.y * CELL + 1, CELL - 2, CELL - 2);
  });
}

export type SnakeLabels = {
  score: string;
  start: string;
  gameOver: string;
  restart: string;
  up: string;
  down: string;
  left: string;
  right: string;
};

export function SnakeGame({ labels }: { labels: SnakeLabels }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  // Game state lives in refs so the interval callback never closes over stale state;
  // React state only mirrors what the UI shows (phase, score).
  const gameRef = React.useRef<GameState | null>(null);
  const phaseRef = React.useRef<Phase>("idle");
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [score, setScore] = React.useState(0);

  const start = React.useCallback((dir: Dir) => {
    gameRef.current = freshGame(dir);
    phaseRef.current = "running";
    setPhase("running");
    setScore(0);
  }, []);

  const turn = React.useCallback(
    (dir: Dir) => {
      if (phaseRef.current !== "running") {
        start(dir);
        return;
      }
      const g = gameRef.current;
      // Compare against the direction of the last applied move, not the queued one,
      // so two quick taps cannot reverse the snake into its own neck.
      if (!g || dir === OPPOSITE[g.dir]) return;
      g.nextDir = dir;
    },
    [start],
  );

  // Game loop: ticks while running, redraws every tick.
  React.useEffect(() => {
    const id = window.setInterval(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (phaseRef.current !== "running" || !gameRef.current) {
        draw(canvas, gameRef.current);
        return;
      }
      const next = step(gameRef.current);
      if (!next) {
        phaseRef.current = "over";
        setPhase("over");
        draw(canvas, gameRef.current);
        return;
      }
      gameRef.current = next;
      setScore(next.snake.length - START_LENGTH);
      draw(canvas, next);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  // Keyboard: arrows and WASD. Arrows would scroll the page otherwise.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const dir = KEY_TO_DIR[e.key];
      if (!dir) return;
      e.preventDefault();
      turn(dir);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [turn]);

  const padButton = (dir: Dir, label: string, Icon: typeof ArrowUp) => (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={label}
      className="h-14 w-14 touch-manipulation select-none"
      onPointerDown={(e) => {
        e.preventDefault();
        turn(dir);
      }}
    >
      <Icon className="h-6 w-6" />
    </Button>
  );

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full max-w-[384px] items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {labels.score}:{" "}
          <span className="font-semibold tabular-nums text-foreground">{score}</span>
        </span>
        {phase !== "idle" && (
          <Button type="button" size="sm" variant="secondary" onClick={() => start("right")}>
            {labels.restart}
          </Button>
        )}
      </div>
      <div className="relative w-full max-w-[384px]">
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          className="aspect-square w-full rounded-md border"
        />
        {phase !== "running" && (
          <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/50 p-4 text-center text-sm font-medium text-white">
            {phase === "over" ? labels.gameOver : labels.start}
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div />
        {padButton("up", labels.up, ArrowUp)}
        <div />
        {padButton("left", labels.left, ArrowLeft)}
        {padButton("down", labels.down, ArrowDown)}
        {padButton("right", labels.right, ArrowRight)}
      </div>
    </div>
  );
}
