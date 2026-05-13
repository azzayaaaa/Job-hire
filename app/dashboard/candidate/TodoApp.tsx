"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { API_URLS } from "@/lib/apiConfig";
import { 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Circle, 
  CalendarDays, 
  Sparkles,
  Zap,
  Copy,
  RotateCcw
} from "lucide-react";

type TodoItem = {
  id: number;
  title: string;
  description?: string;
  done: boolean;
  priority?: "high" | "medium" | "low";
  dueDate?: string;
  category?: string;
  source?: string;
  roadmapDay?: number;
  roadmapGroupId?: string;
  roadmapTopic?: string;
  createdAt: string;
};

type FilterType = "all" | "active" | "completed" | "high" | "medium" | "low";
type LessonState = Record<number, string>;
type QuizQuestion = {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
};
type PlaygroundFiles = {
  html: string;
  css: string;
  js: string;
};

const LANGUAGE_SUGGESTIONS: Record<string, string[]> = {
  html: [
    "article",
    "aside",
    "audio",
    "button",
    "body",
    "blockquote",
    "canvas",
    "div",
    "footer",
    "form",
    "header",
    "html",
    "img",
    "input",
    "label",
    "main",
    "nav",
    "option",
    "p",
    "section",
    "select",
    "span",
    "table",
    "tbody",
    "td",
    "textarea",
    "th",
    "thead",
    "title",
    "tr",
    "ul",
  ],
  css: [
    "align-items",
    "animation",
    "background",
    "background-color",
    "border",
    "border-radius",
    "bottom",
    "box-shadow",
    "color",
    "display",
    "flex",
    "flex-direction",
    "font-family",
    "font-size",
    "font-weight",
    "gap",
    "grid-template-columns",
    "height",
    "justify-content",
    "left",
    "line-height",
    "margin",
    "max-width",
    "min-height",
    "opacity",
    "overflow",
    "padding",
    "position",
    "right",
    "text-align",
    "top",
    "transform",
    "transition",
    "width",
    "z-index",
  ],
  javascript: [
    "async",
    "await",
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "document",
    "else",
    "export",
    "fetch",
    "for",
    "function",
    "if",
    "import",
    "let",
    "map",
    "querySelector",
    "reduce",
    "return",
    "setTimeout",
    "switch",
    "try",
    "window",
  ],
  typescript: ["interface", "type", "extends", "implements", "readonly", "keyof", "unknown", "never"],
  python: ["def", "class", "import", "from", "return", "for", "while", "if", "elif", "else", "print"],
  sql: ["SELECT", "FROM", "WHERE", "JOIN", "ORDER BY", "GROUP BY", "INSERT", "UPDATE", "DELETE"],
  java: ["class", "public", "private", "static", "void", "return", "new", "extends", "implements"],
  c: ["int", "char", "float", "double", "return", "struct", "printf", "scanf"],
  cpp: ["class", "public", "private", "namespace", "std", "vector", "cout", "return"],
};

function getSuggestionPrefix(value: string, cursorPosition: number) {
  const beforeCursor = value.slice(0, cursorPosition);
  const match = beforeCursor.match(/[A-Za-z][A-Za-z-]*$/);
  return match?.[0] || "";
}

function replaceSuggestionPrefix(
  value: string,
  cursorPosition: number,
  prefix: string,
  suggestion: string,
) {
  const start = Math.max(0, cursorPosition - prefix.length);
  return `${value.slice(0, start)}${suggestion}${value.slice(cursorPosition)}`;
}

function SmartCodeEditor({
  label,
  language,
  value,
  onChange,
  className,
  minHeightClass,
}: {
  label: string;
  language: string;
  value: string;
  onChange: (value: string) => void;
  className: string;
  minHeightClass: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(value.length);
  const prefix = getSuggestionPrefix(value, cursorPosition);
  const suggestions = useMemo(() => {
    if (!prefix) return [];
    const normalized = prefix.toLowerCase();
    return (LANGUAGE_SUGGESTIONS[language] || [])
      .filter((item) => item.toLowerCase().startsWith(normalized))
      .slice(0, 6);
  }, [language, prefix]);

  useEffect(() => {
    setActiveIndex(0);
  }, [prefix, language]);

  const acceptSuggestion = (suggestion: string) => {
    const nextValue = replaceSuggestionPrefix(value, cursorPosition, prefix, suggestion);
    onChange(nextValue);
    setCursorPosition(Math.max(0, cursorPosition - prefix.length) + suggestion.length);
  };

  return (
    <label className="relative block">
      <span className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-300">{label}</span>
      <textarea
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setCursorPosition(event.target.selectionStart ?? event.target.value.length);
        }}
        onClick={(event) => setCursorPosition(event.currentTarget.selectionStart ?? value.length)}
        onKeyUp={(event) => setCursorPosition(event.currentTarget.selectionStart ?? value.length)}
        onSelect={(event) => setCursorPosition(event.currentTarget.selectionStart ?? value.length)}
        onKeyDown={(event) => {
          if (!suggestions.length) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((current) => (current + 1) % suggestions.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
          } else if (event.key === "Tab") {
            event.preventDefault();
            acceptSuggestion(suggestions[activeIndex]);
          }
        }}
        spellCheck={false}
        className={`${minHeightClass} w-full resize-y rounded-2xl border border-white/10 bg-[#040914] p-4 font-mono text-sm leading-6 outline-none transition focus:border-white/25 ${className}`}
      />
      {suggestions.length > 0 && (
        <div className="mt-2 overflow-hidden rounded-2xl border border-white/10 bg-[#081120]/98 p-2 shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur">
          <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Suggestions
          </div>
          <div className="grid gap-1">
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => acceptSuggestion(suggestion)}
                className={`flex items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                  index === activeIndex
                    ? "bg-blue-500/18 text-blue-100"
                    : "text-slate-300 hover:bg-white/[0.06]"
                }`}
              >
                <span className="font-semibold">{suggestion}</span>
                <span className="text-[11px] text-slate-500">Tab</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </label>
  );
}

export default function TodoApp({
  userId,
}: {
  userId: number;
}) {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [todoInput, setTodoInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");
  const [priorityInput, setPriorityInput] = useState<"high" | "medium" | "low">("medium");
  const [filter, setFilter] = useState<FilterType>("all");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [stats, setStats] = useState({ total: 0, completed: 0, active: 0 });
  const [showAddForm, setShowAddForm] = useState(false);
  const [roadmapTopic, setRoadmapTopic] = useState("");
  const [roadmapStartDate, setRoadmapStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [generatingRoadmap, setGeneratingRoadmap] = useState(false);
  const [roadmapMessage, setRoadmapMessage] = useState("");
  const [selectedTodoId, setSelectedTodoId] = useState<number | null>(null);
  const [lessonByTodoId, setLessonByTodoId] = useState<LessonState>({});
  const [lessonLoadingId, setLessonLoadingId] = useState<number | null>(null);
  const [lessonError, setLessonError] = useState("");
  const [quizByTodoId, setQuizByTodoId] = useState<Record<number, QuizQuestion[]>>({});
  const [quizAnswers, setQuizAnswers] = useState<Record<number, Record<number, string>>>({});
  const [quizLoadingId, setQuizLoadingId] = useState<number | null>(null);
  const [quizError, setQuizError] = useState("");
  const [playgroundFilesByTodoId, setPlaygroundFilesByTodoId] = useState<Record<number, PlaygroundFiles>>({});
  const [previewFilesByTodoId, setPreviewFilesByTodoId] = useState<Record<number, PlaygroundFiles>>({});
  const lessonPanelRef = useRef<HTMLElement | null>(null);

  const todoStorageKey = `selfImprovementTodos_${userId}`;

  useEffect(() => {
    loadTodos();
    const handleTodosUpdated = () => loadTodos();
    window.addEventListener("jobhub:self-improvement-todos-updated", handleTodosUpdated);
    return () => window.removeEventListener("jobhub:self-improvement-todos-updated", handleTodosUpdated);
  }, [userId, todoStorageKey]);

  useEffect(() => {
    updateStats();
  }, [todos]);

  const loadTodos = () => {
    try {
      const saved = localStorage.getItem(todoStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Array<TodoItem & { note?: string }>;
        setTodos(
          parsed.map((todo) => ({
            ...todo,
            description: todo.description || todo.note || "",
            priority: todo.priority || "medium",
          }))
        );
      }
    } catch {
      setTodos([]);
    }
  };

  const saveTodos = (nextTodos: TodoItem[]) => {
    setTodos(nextTodos);
    localStorage.setItem(todoStorageKey, JSON.stringify(nextTodos));
    window.dispatchEvent(new CustomEvent("jobhub:self-improvement-todos-updated", { detail: { userId } }));
  };

  const updateStats = () => {
    setStats({
      total: todos.length,
      completed: todos.filter((t) => t.done).length,
      active: todos.filter((t) => !t.done).length,
    });
  };

  const addTodo = () => {
    const title = todoInput.trim();
    if (!title) return;

    const newTodo: TodoItem = {
      id: Date.now(),
      title,
      description: descriptionInput.trim(),
      done: false,
      priority: priorityInput,
      source: "manual",
      createdAt: new Date().toISOString(),
    };

    saveTodos([newTodo, ...todos]);
    setTodoInput("");
    setDescriptionInput("");
    setPriorityInput("medium");
    setShowAddForm(false);
  };

  const toggleTodo = (id: number) => {
    saveTodos(todos.map((todo) => (todo.id === id ? { ...todo, done: !todo.done } : todo)));
  };

  const deleteTodo = (id: number) => {
    saveTodos(todos.filter((todo) => todo.id !== id));
  };

  const duplicateTodo = (todo: TodoItem) => {
    const newTodo = {
      ...todo,
      id: Date.now(),
      done: false,
      createdAt: new Date().toISOString(),
    };
    saveTodos([newTodo, ...todos]);
  };

  const formatRoadmapDate = (value?: string) => {
    if (!value) return "";
    return new Date(`${value}T00:00:00`).toLocaleDateString("mn-MN", {
      month: "long",
      day: "numeric",
    });
  };

  const buildRoadmapDueDate = (startDate: string, dayOffset: number) => {
    const baseDate = startDate ? new Date(`${startDate}T00:00:00`) : new Date();
    baseDate.setDate(baseDate.getDate() + dayOffset);
    return baseDate.toISOString().slice(0, 10);
  };

  const generateRoadmap = async () => {
    const topic = roadmapTopic.trim();
    if (!topic || generatingRoadmap) return;

    setGeneratingRoadmap(true);
    setRoadmapMessage("");

    try {
      const response = await axios.post(API_URLS.ai.generateRoadmap(), {
        topic,
        days: 30,
        userId,
      });

      const roadmap = Array.isArray(response.data?.roadmap) ? response.data.roadmap : [];
      if (!roadmap.length) {
        throw new Error("Roadmap хоосон ирлээ.");
      }

      const now = Date.now();
      const roadmapGroupId = `roadmap-${now}`;
      const generatedTodos: TodoItem[] = roadmap.slice(0, 30).map((item: any, index: number) => {
        const dayNumber = Number(item?.day) || index + 1;
        const dueDate = buildRoadmapDueDate(roadmapStartDate, dayNumber - 1);
        const title = String(item?.title || item?.task || `${topic} сурах алхам ${dayNumber}`).trim();
        const description = String(
          item?.description ||
            item?.note ||
            item?.details ||
            `${topic} сэдвийн ${dayNumber}-р өдрийн сурах ажил.`
        ).trim();

        return {
          id: now + index,
          title: `Өдөр ${dayNumber}: ${title}`,
          description,
          done: false,
          priority: dayNumber <= 7 ? "high" : dayNumber <= 21 ? "medium" : "low",
          dueDate,
          category: "roadmap",
          source: "AI",
          roadmapDay: dayNumber,
          roadmapGroupId,
          roadmapTopic: topic,
          createdAt: new Date().toISOString(),
        };
      });

      saveTodos([...generatedTodos, ...todos]);
      setRoadmapTopic("");
      setRoadmapMessage("30 хоногийн AI roadmap TODO жагсаалт руу нэмэгдлээ.");
    } catch (error: any) {
      const details = error?.response?.data?.message || error?.message || "";
      setRoadmapMessage(
        details
          ? `Roadmap үүсгэхэд алдаа гарлаа: ${details}`
          : "Roadmap үүсгэхэд алдаа гарлаа. Дахин оролдоно уу."
      );
    } finally {
      setGeneratingRoadmap(false);
    }
  };

  const teachTodo = async (todo: TodoItem) => {
    setSelectedTodoId(todo.id);
    setLessonError("");
    window.setTimeout(() => {
      if (window.innerWidth < 1280) {
        lessonPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 80);
    if (lessonByTodoId[todo.id]) return;

    setLessonLoadingId(todo.id);
    try {
      const response = await axios.post(API_URLS.ai.ask(), {
        systemContext:
          "Чи JobHub-ийн AI багш. Хариултаа сурагч шууд ойлгож, туршиж болохоор Монгол хэлээр бич.",
        message: `
Teach me about "${todo.title}".

Хичээлийг яг дараах бүтэцтэй өг:

## Товч тайлбар
2-4 өгүүлбэрээр энэ task-ийн гол ойлголтыг тайлбарла.

## HTML code block
Сурагч шууд preview хийж болох ажилладаг HTML жишээг fenced code block хэлбэрээр өг:
\`\`\`html
...
\`\`\`

## Дараагийн алхам
1-3 богино actionable алхам өг.

TODO-ийн тайлбар:
${todo.description || "Тайлбар байхгүй"}
`.trim(),
      });

      const lesson = String(response.data?.answer || response.data?.reply || "").trim();
      if (!lesson) throw new Error("AI хичээл хоосон ирлээ.");
      setLessonByTodoId((prev) => ({ ...prev, [todo.id]: lesson }));
      const starterFiles = extractPlaygroundFiles(lesson);
      if (starterFiles.html || starterFiles.css || starterFiles.js) {
        setPlaygroundFilesByTodoId((prev) => ({ ...prev, [todo.id]: prev[todo.id] || starterFiles }));
        setPreviewFilesByTodoId((prev) => ({ ...prev, [todo.id]: prev[todo.id] || starterFiles }));
      }
    } catch (error: any) {
      setLessonError(
        error?.response?.data?.error ||
          error?.message ||
          "Хичээлийн тайлбар авахад алдаа гарлаа."
      );
    } finally {
      setLessonLoadingId(null);
    }
  };

  const selectedTodo = todos.find((todo) => todo.id === selectedTodoId) || null;
  const isSelectedRoadmapFinalLesson = Boolean(
    selectedTodo &&
      selectedTodo.category === "roadmap" &&
      (
        selectedTodo.roadmapDay === 30 ||
        /(?:Өдөр|Day)\s*30\b/i.test(selectedTodo.title) ||
        (selectedTodo.roadmapGroupId &&
          Math.max(
            ...todos
              .filter((todo) => todo.roadmapGroupId === selectedTodo.roadmapGroupId)
              .map((todo) => Number(todo.roadmapDay || 0)),
          ) === Number(selectedTodo.roadmapDay || 0))
      ),
  );

  const generateQuiz = async (todo: TodoItem) => {
    if (quizByTodoId[todo.id]) return;
    setQuizLoadingId(todo.id);
    setQuizError("");

    try {
      const response = await axios.post(API_URLS.ai.ask(), {
        systemContext:
          "Чи сургалтын шалгалт бэлддэг AI. Зөвхөн хүчинтэй JSON массив буцаа.",
        message: `
Create a final quiz in Mongolian for this completed roadmap topic:
"${todo.title}"

Return ONLY valid JSON array:
[
  {
    "question": "Асуулт",
    "options": ["A", "B", "C", "D"],
    "correctAnswer": "A",
    "explanation": "Яагаад зөв болох тайлбар"
  }
]

Rules:
1. Exactly 5 questions.
2. Every question must have 4 options.
3. correctAnswer must match one option exactly.
4. Questions should test the whole learning journey, not only the last task.
`.trim(),
      });

      const raw = String(response.data?.answer || response.data?.reply || "").trim();
      const json = raw.match(/\[[\s\S]*\]/)?.[0];
      const parsed = json ? JSON.parse(json) : [];
      const normalized = Array.isArray(parsed)
        ? parsed
            .slice(0, 5)
            .map((item: any) => {
              const options = Array.isArray(item?.options)
                ? item.options.map((option: unknown) => String(option).trim()).filter(Boolean).slice(0, 4)
                : [];
              const rawCorrectAnswer = item?.correctAnswer;
              const directAnswer = String(rawCorrectAnswer ?? "").trim();
              const answerIndex =
                typeof rawCorrectAnswer === "number" || /^\d+$/.test(directAnswer)
                  ? Number(rawCorrectAnswer)
                  : Number.NaN;
              const correctAnswer = options.includes(directAnswer)
                ? directAnswer
                : Number.isFinite(answerIndex)
                  ? options[answerIndex] || options[answerIndex - 1] || ""
                  : directAnswer;

              return {
                question: String(item?.question || "").trim(),
                options,
                correctAnswer,
                explanation: String(item?.explanation || "").trim(),
              };
            })
            .filter((item) => item.question && item.options.length === 4 && item.correctAnswer)
        : [];

      if (!normalized.length) {
        throw new Error("Шалгалтын асуулт хоосон ирлээ.");
      }

      setQuizByTodoId((prev) => ({ ...prev, [todo.id]: normalized }));
    } catch (error: any) {
      setQuizError(
        error?.response?.data?.error ||
          error?.message ||
          "Шалгалт үүсгэхэд алдаа гарлаа."
      );
    } finally {
      setQuizLoadingId(null);
    }
  };

  const selectQuizAnswer = (todoId: number, questionIndex: number, option: string) => {
    setQuizAnswers((prev) => ({
      ...prev,
      [todoId]: {
        ...(prev[todoId] || {}),
        [questionIndex]: option,
      },
    }));
  };

  function extractPlaygroundFiles(content: string): PlaygroundFiles {
    const matches = Array.from(content.matchAll(/```([a-zA-Z]*)\s*([\s\S]*?)```/g));
    const files: PlaygroundFiles = { html: "", css: "", js: "" };

    for (const [, rawLanguage, rawCode] of matches) {
      const language = rawLanguage.toLowerCase();
      const code = rawCode.trim();
      if (!code) continue;

      if (!files.html && (language === "html" || language === "xml")) {
        files.html = code;
        continue;
      }
      if (!files.css && language === "css") {
        files.css = code;
        continue;
      }
      if (!files.js && ["js", "javascript", "jsx", "tsx"].includes(language)) {
        files.js = code;
        continue;
      }

      if (!files.html && /<!doctype html>|<html[\s>]|<[a-z][\s\S]*>/i.test(code)) {
        files.html = code;
      } else if (!files.css && /[.#]?[a-zA-Z][\w\s,:.#>*+~\[\]="'-]*\{[\s\S]*\}/.test(code)) {
        files.css = code;
      } else if (!files.js) {
        files.js = code;
      }
    }

    if (!files.html && files.css) {
      files.html = `<main class="preview-shell">
  <h1>CSS Preview</h1>
  <p>Энд HTML ба CSS хамтдаа ажиллаж харагдана.</p>
  <button>Demo Button</button>
</main>`;
    }

    return files;
  }

  const updatePlaygroundFile = (todoId: number, key: keyof PlaygroundFiles, value: string) => {
    setPlaygroundFilesByTodoId((prev) => ({
      ...prev,
      [todoId]: {
        ...(prev[todoId] || { html: "", css: "", js: "" }),
        [key]: value,
      },
    }));
  };

  const runPlaygroundPreview = (todoId: number) => {
    setPreviewFilesByTodoId((prev) => ({
      ...prev,
      [todoId]: playgroundFilesByTodoId[todoId] || { html: "", css: "", js: "" },
    }));
  };

  const buildPreviewDocument = (files: PlaygroundFiles) => {
    const html = files.html.trim();
    const css = files.css.trim();
    const js = files.js.trim();
    if (!html && !css && !js) return "";

    if (/<!doctype html>|<html[\s>]/i.test(html)) {
      if (!css && !js) return html;
      return html.replace(
        /<\/head>/i,
        `${css ? `<style>${css}</style>` : ""}${js ? `<script>${js}</script>` : ""}</head>`,
      );
    }

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { margin: 0; padding: 32px; min-height: 100vh; box-sizing: border-box; font-family: Arial, sans-serif; background: #f8fafc; color: #0f172a; }
      .preview-shell {
        max-width: 720px;
        margin: 0 auto;
        padding: 24px;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.88);
        border: 1px solid rgba(15, 23, 42, 0.08);
      }
      p { line-height: 1.7; }
      button {
        margin-top: 12px;
        border: 0;
        border-radius: 10px;
        padding: 10px 14px;
        background: #2563eb;
        color: white;
        font-weight: 700;
      }
      ${css}
    </style>
  </head>
  <body>
    ${html || `<main class="preview-shell"><h1>Preview</h1><p>HTML, CSS, JS хамтдаа ажиллах талбар.</p></main>`}
    ${js ? `<script>${js}</script>` : ""}
  </body>
</html>`;
  };

  const completedRoadmapCount = todos.filter((todo) => todo.category === "roadmap" && todo.done).length;
  const answeredQuizCount = Object.values(quizAnswers).reduce(
    (count, answerMap) => count + Object.keys(answerMap).length,
    0,
  );
  const experiencePoints = stats.completed * 25 + answeredQuizCount * 5;
  const level = Math.max(1, Math.floor(experiencePoints / 100) + 1);
  const levelProgress = experiencePoints % 100;
  const completionPercent = stats.total ? Math.round((stats.completed / stats.total) * 100) : 0;
  const achievements = [
    stats.completed >= 1 ? "Эхний зорилго" : null,
    stats.completed >= 10 ? "10 task дуусгасан" : null,
    completedRoadmapCount >= 30 ? "30 хоногийн замнал" : null,
    answeredQuizCount >= 5 ? "Шалгалтын гараа" : null,
  ].filter(Boolean) as string[];

  const clearCompleted = () => {
    if (confirm("Бүх дууссан TODO-г устгах уу?")) {
      saveTodos(todos.filter((todo) => !todo.done));
    }
  };

  const clearAllTodos = () => {
    if (!todos.length) return;
    if (confirm("Бүх TODO-г бүрэн устгах уу? Энэ үйлдлийг буцаах боломжгүй.")) {
      saveTodos([]);
    }
  };

  const getFilteredTodos = () => {
    return todos.filter((todo) => {
      switch (filter) {
        case "active":
          return !todo.done;
        case "completed":
          return todo.done;
        case "high":
          return todo.priority === "high";
        case "medium":
          return todo.priority === "medium";
        case "low":
          return todo.priority === "low";
        default:
          return true;
      }
    });
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case "high":
        return "bg-red-500/10 border-red-500/30 text-red-400";
      case "medium":
        return "bg-amber-500/10 border-amber-500/30 text-amber-400";
      case "low":
        return "bg-green-500/10 border-green-500/30 text-green-400";
      default:
        return "bg-blue-500/10 border-blue-500/30 text-blue-400";
    }
  };

  const filteredTodos = getFilteredTodos();

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-gradient-to-br from-[#060c18] to-[#0a0f1f]">
      {/* Header */}
      <div className="border-b border-white/10 bg-[#060c18]">
        <div className="mx-auto max-w-[1500px] px-4 py-6 md:px-8">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-black text-white sm:text-4xl">Миний TODO</h1>
              <p className="mt-2 text-sm text-slate-400">Өөрийгөө хөгжүүлэх зорилгоо удирдаарай</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={clearAllTodos}
                disabled={!todos.length}
                className="inline-flex h-12 items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 text-sm font-bold text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 size={18} />
                <span className="hidden sm:inline">Бүгдийг устгах</span>
              </button>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-blue-600 px-6 font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                <Plus size={20} />
                <span className="hidden sm:inline">Шинэ TODO</span>
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:gap-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Нийт</p>
              <p className="mt-2 text-3xl font-black text-white">{stats.total}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Идэвхтэй</p>
              <p className="mt-2 text-3xl font-black text-amber-400">{stats.active}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Дууссан</p>
              <p className="mt-2 text-3xl font-black text-emerald-400">{stats.completed}</p>
            </div>
          </div>

          <div className="mt-5 hidden gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <section className="rounded-2xl border border-fuchsia-400/15 bg-gradient-to-br from-blue-500/12 via-purple-500/10 to-cyan-500/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-blue-200">Learning Progress</p>
                  <p className="mt-1 text-2xl font-black text-white">Level {level}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-right">
                  <p className="text-xs text-slate-400">XP</p>
                  <p className="text-lg font-black text-cyan-200">{experiencePoints}</p>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span>Дараагийн level</span>
                  <span>{levelProgress}/100 XP</span>
                </div>
                <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-400 via-cyan-300 to-emerald-300 transition-all"
                    style={{ width: `${levelProgress}%` }}
                  />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/15 p-3">
                  <p className="text-xs text-slate-400">Completion</p>
                  <p className="mt-1 text-lg font-black text-white">{completionPercent}%</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/15 p-3">
                  <p className="text-xs text-slate-400">Roadmap Done</p>
                  <p className="mt-1 text-lg font-black text-white">{completedRoadmapCount}</p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-amber-400/15 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-amber-200">Achievements</p>
                  <p className="mt-1 text-sm text-slate-400">Урамшууллын тэмдэгүүд</p>
                </div>
                <div className="rounded-full bg-amber-400/15 px-3 py-1 text-xs font-black text-amber-100">
                  {achievements.length}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {achievements.length ? (
                  achievements.map((achievement) => (
                    <span
                      key={achievement}
                      className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1.5 text-xs font-bold text-amber-100"
                    >
                      {achievement}
                    </span>
                  ))
                ) : (
                  <p className="rounded-xl border border-dashed border-white/10 px-3 py-3 text-sm text-slate-500">
                    Эхний task-аа дуусгаад achievement нээгээрэй.
                  </p>
                )}
              </div>
            </section>
          </div>

          <div className="mt-5 hidden rounded-2xl border border-blue-500/20 bg-blue-500/[0.08] p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
              <div className="min-w-0 flex-1">
                <p className="mb-2 inline-flex items-center gap-2 text-sm font-bold text-blue-200">
                  <Sparkles size={16} />
                  AI 30 хоногийн сурах roadmap
                </p>
                <input
                  value={roadmapTopic}
                  onChange={(event) => setRoadmapTopic(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && generateRoadmap()}
                  placeholder="Жишээ: HTML, React, Python, UI/UX Design..."
                  className="w-full rounded-xl border border-white/10 bg-[#0d1117] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-400/60"
                />
              </div>

              <label className="w-full lg:w-48">
                <span className="mb-2 block text-xs font-semibold uppercase text-slate-400">Эхлэх өдөр</span>
                <input
                  type="date"
                  value={roadmapStartDate}
                  onChange={(event) => setRoadmapStartDate(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#0d1117] px-4 py-3 text-sm text-white outline-none focus:border-blue-400/60"
                />
              </label>

              <button
                type="button"
                onClick={generateRoadmap}
                disabled={!roadmapTopic.trim() || generatingRoadmap}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
              >
                <Sparkles size={16} className={generatingRoadmap ? "animate-spin" : ""} />
                {generatingRoadmap ? "Үүсгэж байна..." : "Roadmap гаргах"}
              </button>
            </div>

            {roadmapMessage && (
              <p className="mt-3 text-sm text-slate-300">{roadmapMessage}</p>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-[1500px] px-4 py-8 md:px-8">
        {/* Add Form */}
        {showAddForm && (
          <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
            <h2 className="mb-4 text-lg font-bold text-white">Шинэ TODO нэмэх</h2>
            <div className="space-y-4">
              <input
                value={todoInput}
                onChange={(e) => setTodoInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTodo()}
                placeholder="TODO-ний гарчиг..."
                className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:border-blue-500/50 focus:bg-white/[0.08] transition-colors"
              />
              <textarea
                value={descriptionInput}
                onChange={(e) => setDescriptionInput(e.target.value)}
                placeholder="Дэлгэрэнгүй мэдээлэл (сонгомол)..."
                className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:border-blue-500/50 focus:bg-white/[0.08] transition-colors resize-none"
                rows={3}
              />
              <div className="flex gap-3 flex-wrap">
                <select
                  value={priorityInput}
                  onChange={(e) => setPriorityInput(e.target.value as any)}
                  className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-white outline-none focus:border-blue-500/50 focus:bg-white/[0.08] transition-colors"
                >
                  <option value="low">Бага</option>
                  <option value="medium">Дунд</option>
                  <option value="high">Өндөр</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={addTodo}
                  className="flex-1 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 transition-colors"
                >
                  Нэмэх
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setTodoInput("");
                    setDescriptionInput("");
                    setPriorityInput("medium");
                  }}
                  className="flex-1 rounded-xl border border-white/10 px-4 py-2 font-semibold text-slate-400 hover:text-white hover:border-white/20 transition-colors"
                >
                  Цуцлах
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {(["all", "active", "completed", "high", "medium", "low"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                filter === f
                  ? "bg-blue-600 text-white"
                  : "border border-white/10 text-slate-400 hover:text-white hover:border-white/30"
              }`}
            >
              {f === "all"
                ? "Бүгд"
                : f === "active"
                ? "Идэвхтэй"
                : f === "completed"
                ? "Дууссан"
                : f === "high"
                ? "Өндөр"
                : f === "medium"
                ? "Дунд"
                : "Бага"}
            </button>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_520px]">
          {/* TODO List */}
          {filteredTodos.length > 0 ? (
            <div className="order-2 min-w-0 space-y-3 xl:order-1">
              {filteredTodos.map((todo) => (
              <div
                key={todo.id}
                className={`group rounded-xl border transition-all ${
                  todo.done
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : selectedTodoId === todo.id
                    ? "border-blue-400/50 bg-blue-500/[0.08]"
                    : "border-white/10 bg-white/[0.04] hover:bg-white/[0.06]"
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start gap-4">
                    <button
                      onClick={() => toggleTodo(todo.id)}
                      className="mt-1 shrink-0 text-slate-400 hover:text-white transition-colors"
                    >
                      {todo.done ? (
                        <CheckCircle2 size={24} className="text-emerald-500" />
                      ) : (
                        <Circle size={24} />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => teachTodo(todo)}
                      className="min-w-0 flex-1 cursor-pointer text-left"
                      aria-label={`${todo.title} AI хичээл нээх`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p
                          className={`text-base font-semibold ${
                            todo.done ? "text-slate-500 line-through" : "text-white"
                          }`}
                        >
                          {todo.title}
                        </p>
                        {todo.priority && (
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold shrink-0 ${getPriorityColor(todo.priority)}`}>
                            <Zap size={12} />
                            {todo.priority === "high"
                              ? "Өндөр"
                              : todo.priority === "medium"
                              ? "Дунд"
                              : "Бага"}
                          </span>
                        )}
                      </div>

                      {todo.description && (
                        <p className={`text-sm mb-3 leading-relaxed ${todo.done ? "text-slate-600" : "text-slate-400"}`}>
                          {todo.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        {todo.dueDate && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-1 text-blue-200">
                            <CalendarDays size={14} />
                            {formatRoadmapDate(todo.dueDate)}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays size={14} />
                          {new Date(todo.createdAt).toLocaleDateString("mn-MN")}
                        </span>
                        {todo.source && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1">
                            {todo.source === "AI" ? "AI санал" : "Гараар нэмсэн"}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/10 px-2 py-1 text-cyan-200">
                          <Sparkles size={13} />
                          AI хичээл
                        </span>
                      </div>
                    </button>

                    {/* Action Menu */}
                    <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => duplicateTodo(todo)}
                        className="text-slate-400 hover:text-blue-400 transition-colors p-2 hover:bg-white/5 rounded-lg"
                        title="Дахих"
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        onClick={() => deleteTodo(todo.id)}
                        className="text-slate-400 hover:text-red-400 transition-colors p-2 hover:bg-white/5 rounded-lg"
                        title="Устгах"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              ))}
            </div>
          ) : (
            <div className="order-2 rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center xl:order-1">
              <Circle size={40} className="mx-auto mb-4 text-slate-600" />
              <p className="text-lg font-semibold text-slate-400">
                {filter === "all"
                  ? "Одоогоор TODO байхгүй"
                  : "Энэ ангилалд TODO байхгүй"}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                {filter === "all"
                  ? "Дээрх товчлуурыг дарж шинэ TODO нэмэх"
                  : "Өөр ангилал сонгоно уу эсвэл шинэ TODO нэмэх"}
              </p>
            </div>
          )}

          <aside ref={lessonPanelRef} className={`min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_24px_80px_rgba(0,0,0,0.28)] ${selectedTodoId ? "order-1" : "order-3"} xl:sticky xl:top-6 xl:order-2 xl:h-[calc(100vh-7rem)]`}>
            <div className="border-b border-white/10 bg-[#091120]/95 p-4 backdrop-blur sm:p-6">
              <div className="flex items-center gap-2">
                <Sparkles size={20} className="text-blue-300" />
                <h2 className="text-xl font-black text-white">AI Content View</h2>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Өдрийн task дээр дарахад тухайн сэдвийн mini-lesson энд нээгдэнэ.
              </p>
              {selectedTodo && (
                <div className="mt-3 rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2">
                  <p className="text-xs font-semibold uppercase text-blue-200">Сонгосон өдөр</p>
                  <p className="mt-1 text-sm font-bold text-white">{selectedTodo.title}</p>
                </div>
              )}
            </div>

            <div className="max-h-none overflow-y-visible p-4 sm:p-6 xl:h-[calc(100%-12.5rem)] xl:overflow-y-auto">

            {!selectedTodoId ? (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-500">
                Эхлэх task-аа сонгоно уу.
              </div>
            ) : lessonLoadingId === selectedTodoId ? (
              <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-8 text-center">
                <Sparkles size={24} className="mx-auto animate-spin text-blue-300" />
                <p className="mt-3 text-sm font-semibold text-blue-100">AI багш хичээлийг бэлдэж байна...</p>
              </div>
            ) : lessonByTodoId[selectedTodoId] ? (
              <div className="space-y-6">
                <article className="min-w-0 rounded-2xl border border-white/10 bg-[#0b1324] p-4 md:rounded-3xl md:p-6">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ children }) => (
                        <h1 className="mb-4 mt-1 text-2xl font-black text-white">{children}</h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="mb-3 mt-6 border-l-4 border-blue-400 pl-3 text-xl font-black text-blue-100">
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="mb-3 mt-6 rounded-xl bg-gradient-to-r from-blue-500/18 to-purple-500/14 px-4 py-3 text-base font-black text-blue-100 ring-1 ring-inset ring-blue-400/20">
                          {children}
                        </h3>
                      ),
                      p: ({ children }) => (
                        <p className="mb-4 break-words text-[15px] leading-8 text-slate-200">{children}</p>
                      ),
                      ul: ({ children }) => (
                        <ul className="mb-5 space-y-2 pl-5 text-[15px] leading-7 text-slate-200 marker:text-blue-300">
                          {children}
                        </ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="mb-5 space-y-2 pl-5 text-[15px] leading-7 text-slate-200 marker:font-black marker:text-purple-300">
                          {children}
                        </ol>
                      ),
                      li: ({ children }) => <li className="pl-1">{children}</li>,
                      strong: ({ children }) => <strong className="font-black text-white">{children}</strong>,
                      a: ({ children, href }) => (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-cyan-300 underline decoration-cyan-400/50 underline-offset-4 transition hover:text-cyan-200"
                        >
                          {children}
                        </a>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote className="mb-5 rounded-2xl border border-purple-400/20 bg-purple-500/10 px-4 py-3 text-sm leading-7 text-purple-50">
                          {children}
                        </blockquote>
                      ),
                      pre: ({ children }) => (
                        <pre className="mb-5 max-w-full overflow-x-auto rounded-2xl border border-cyan-400/15 bg-[#050b16] p-4 text-sm leading-7 text-cyan-100 shadow-inner">
                          {children}
                        </pre>
                      ),
                      code: ({ className, children }) =>
                        className ? (
                          <code className={`${className} font-mono text-sm text-cyan-100`}>{children}</code>
                        ) : (
                          <code className="rounded-md border border-white/10 bg-white/10 px-1.5 py-0.5 font-mono text-[13px] text-cyan-100">
                            {children}
                          </code>
                        ),
                      hr: () => <hr className="my-6 border-white/10" />,
                    }}
                  >
                    {lessonByTodoId[selectedTodoId]}
                  </ReactMarkdown>
                </article>

                {selectedTodo && playgroundFilesByTodoId[selectedTodo.id] && (
                  <section className="min-w-0 rounded-2xl border border-cyan-400/15 bg-[#07111f] p-4 md:rounded-3xl md:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-cyan-100">Coding Playground</p>
                        <p className="mt-1 text-sm text-slate-400">
                          Кодоо засаж бичээд preview-г шууд шинэчилнэ.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => runPlaygroundPreview(selectedTodo.id)}
                        className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-black text-[#06202a] transition hover:bg-cyan-300"
                      >
                        Preview
                      </button>
                    </div>
                    <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-2">
                      <div className="space-y-3">
                        <SmartCodeEditor
                          label="HTML"
                          language="html"
                          value={playgroundFilesByTodoId[selectedTodo.id].html}
                          onChange={(value) => updatePlaygroundFile(selectedTodo.id, "html", value)}
                          className="text-cyan-100 focus:border-cyan-300/50"
                          minHeightClass="min-h-[240px]"
                        />
                      </div>
                      <div className="space-y-3">
                        <SmartCodeEditor
                          label="CSS"
                          language="css"
                          value={playgroundFilesByTodoId[selectedTodo.id].css}
                          onChange={(value) => updatePlaygroundFile(selectedTodo.id, "css", value)}
                          className="text-fuchsia-100 focus:border-fuchsia-300/50"
                          minHeightClass="min-h-[240px]"
                        />
                      </div>
                    </div>

                    {playgroundFilesByTodoId[selectedTodo.id].js && (
                      <div className="mt-4">
                        <SmartCodeEditor
                          label="JavaScript"
                          language="javascript"
                          value={playgroundFilesByTodoId[selectedTodo.id].js}
                          onChange={(value) => updatePlaygroundFile(selectedTodo.id, "js", value)}
                          className="text-amber-100 focus:border-amber-300/50"
                          minHeightClass="min-h-[180px]"
                        />
                      </div>
                    )}

                    <div className="mt-4">
                      <p className="mb-2 text-xs font-black uppercase text-slate-300">Preview</p>
                      <iframe
                        title={`preview-${selectedTodo.id}`}
                        srcDoc={buildPreviewDocument(
                          previewFilesByTodoId[selectedTodo.id] ||
                            playgroundFilesByTodoId[selectedTodo.id] ||
                            { html: "", css: "", js: "" },
                        )}
                        sandbox="allow-scripts"
                        className="min-h-[260px] w-full rounded-2xl border border-white/10 bg-white sm:min-h-[360px]"
                      />
                    </div>
                  </section>
                )}

                {selectedTodo && isSelectedRoadmapFinalLesson && !selectedTodo.done && (
                  <section className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
                    <p className="text-sm font-black text-amber-100">Шалгалт ойрхон байна</p>
                    <p className="mt-1 text-sm leading-6 text-amber-50/80">
                      Сүүлийн хичээлээ дууссан гэж тэмдэглэсний дараа шалгалт нээгдэнэ.
                    </p>
                  </section>
                )}

                {selectedTodo && isSelectedRoadmapFinalLesson && selectedTodo.done && (
                  <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                    <p className="text-sm font-black text-emerald-100">Сүүлийн хичээл дууслаа</p>
                    <p className="mt-1 text-sm leading-6 text-emerald-50/80">
                      Одоо ойлголтоо шалгах 5 асуулттай тест өгөөрэй.
                    </p>
                    <button
                      type="button"
                      onClick={() => generateQuiz(selectedTodo)}
                      disabled={quizLoadingId === selectedTodo.id}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-black text-[#062012] transition hover:bg-emerald-400 disabled:opacity-60"
                    >
                      <Sparkles size={16} className={quizLoadingId === selectedTodo.id ? "animate-spin" : ""} />
                      {quizLoadingId === selectedTodo.id ? "Шалгалт үүсгэж байна..." : "Шалгалт өгөх"}
                    </button>
                  </section>
                )}

                {selectedTodo && quizError && (
                  <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
                    {quizError}
                  </div>
                )}

                {selectedTodo && quizByTodoId[selectedTodo.id] && (
                  <section className="space-y-4 rounded-2xl border border-white/10 bg-[#0b1324] p-4">
                    <div>
                      <p className="text-sm font-black text-white">AI шалгалт</p>
                      <p className="mt-1 text-xs text-slate-400">Зөв гэж үзсэн хариултаа сонгоно уу.</p>
                    </div>
                    {quizByTodoId[selectedTodo.id].map((question, questionIndex) => {
                      const chosen = quizAnswers[selectedTodo.id]?.[questionIndex];
                      return (
                        <div key={`quiz-${questionIndex}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                          <p className="text-sm font-bold leading-6 text-white">
                            {questionIndex + 1}. {question.question}
                          </p>
                          <div className="mt-3 grid gap-2">
                            {question.options.map((option) => {
                              const selected = chosen === option;
                              return (
                                <button
                                  key={option}
                                  type="button"
                                  onClick={() => selectQuizAnswer(selectedTodo.id, questionIndex, option)}
                                  className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                                    selected
                                      ? "border-blue-400 bg-blue-500/15 text-blue-100"
                                      : "border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/20"
                                  }`}
                                >
                                  {option}
                                </button>
                              );
                            })}
                          </div>
                          {chosen && (
                            <div className="mt-3 rounded-xl bg-black/20 p-3 text-xs leading-6 text-slate-300">
                              <p className={chosen === question.correctAnswer ? "text-emerald-300" : "text-amber-300"}>
                                {chosen === question.correctAnswer ? "Зөв хариулт." : `Зөв хариулт: ${question.correctAnswer}`}
                              </p>
                              {question.explanation && <p className="mt-1">{question.explanation}</p>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </section>
                )}
              </div>
            ) : lessonError ? (
              <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
                {lessonError}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-500">
                Сонгосон task-ийн хичээл хараахан ачаалагдаагүй байна.
              </div>
            )}
            </div>
          </aside>
        </div>

        {/* Clear Completed Button */}
        {stats.completed > 0 && (
          <div className="mt-8 text-center">
            <button
              onClick={clearCompleted}
              className="inline-flex items-center gap-2 rounded-lg text-slate-400 hover:text-red-400 transition-colors px-4 py-2 hover:bg-white/5"
            >
              <RotateCcw size={16} />
              Дууссан TODO-г устгах ({stats.completed})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
