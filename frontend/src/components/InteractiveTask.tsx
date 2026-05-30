import { ArrowDown, ArrowUp, BarChart3, CheckCircle2, Lightbulb, Send, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { api } from "../api";
import type { Task } from "../types";

type Point = {
  label: string;
  value: number;
};

type InteractiveTaskProps = {
  task: Task;
  onSolved: (isCorrect: boolean) => Promise<void>;
};

export function InteractiveTask({ task, onSolved }: InteractiveTaskProps) {
  const [answer, setAnswer] = useState(task.result?.answer ?? "");
  const [selectedOptions, setSelectedOptions] = useState<string[]>(() => splitMultiAnswer(task.result?.answer));
  const [orderedItems, setOrderedItems] = useState<string[]>(() => {
    const rawItems = task.payload.items;
    return Array.isArray(rawItems) ? shuffleItems(rawItems.map(String)) : [];
  });
  const [status, setStatus] = useState(task.result?.is_correct ? "Верно" : "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const options = useMemo(() => {
    const rawOptions = task.payload.options;
    return Array.isArray(rawOptions) ? rawOptions.map(String) : [];
  }, [task.payload.options]);
  const optionsKey = options.join("\u0001");
  const shuffledOptions = useMemo(() => shuffleItems(options), [task.id, optionsKey]);

  const points = useMemo(() => {
    const rawPoints = task.payload.points;
    return Array.isArray(rawPoints) ? (rawPoints as Point[]) : [];
  }, [task.payload.points]);
  const pointsKey = points.map((point) => `${point.label}:${point.value}`).join("\u0001");
  const shuffledAnswerPoints = useMemo(() => shuffleItems(points), [task.id, pointsKey]);

  async function submit(nextAnswer = answer) {
    setIsSubmitting(true);
    try {
      const response = await api.submitTask(task.id, nextAnswer);
      setAnswer(nextAnswer);
      setStatus(response.message);
      await onSolved(response.result.is_correct);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось отправить ответ");
    } finally {
      setIsSubmitting(false);
    }
  }

  function submitSelectedOptions() {
    const nextAnswer = options.filter((option) => selectedOptions.includes(option)).join("|");
    void submit(nextAnswer);
  }

  const isCorrect = task.result?.is_correct || status.startsWith("Верно");

  return (
    <section className={`task-panel ${isCorrect ? "task-panel--done" : ""}`}>
      <div className="task-header">
        <span className="task-icon">
          {task.type === "chart" ? <BarChart3 size={18} /> : <Lightbulb size={18} />}
        </span>
        <div>
          <h3>{task.title}</h3>
          <p>{task.prompt}</p>
        </div>
      </div>

      {task.image_url && task.type !== "rebus" && <img className="task-image" src={task.image_url} alt="" />}

      {task.type === "quiz" && (
        <div className="option-grid">
          {shuffledOptions.map((option, index) => (
            <button
              className={answer === option ? "option-button option-button--active" : "option-button"}
              disabled={isSubmitting}
              key={`${option}-${index}`}
              type="button"
              onClick={() => void submit(option)}
            >
              {option}
            </button>
          ))}
        </div>
      )}

      {task.type === "chart" && (
        <>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={points}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#2f6f6a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-choice-grid">
            {shuffledAnswerPoints.map((point, index) => (
              <button
                className={answer === point.label ? "option-button option-button--active" : "option-button"}
                disabled={isSubmitting}
                key={`${point.label}-${index}`}
                type="button"
                onClick={() => void submit(point.label)}
              >
                {point.label}
              </button>
            ))}
          </div>
        </>
      )}

      {task.type === "rebus" && (
        <>
          <div className="rebus-box">
            {task.image_url ? (
              <img className="rebus-image" src={task.image_url} alt="" />
            ) : (
              <strong>{String(task.payload.clue ?? "")}</strong>
            )}
            {String(task.payload.hint ?? "") && <span>{String(task.payload.hint)}</span>}
          </div>
          <AnswerForm
            answer={answer}
            isSubmitting={isSubmitting}
            setAnswer={setAnswer}
            submit={() => void submit()}
          />
        </>
      )}

      {task.type === "text_input" && (
        <AnswerForm
          answer={answer}
          isSubmitting={isSubmitting}
          setAnswer={setAnswer}
          submit={() => void submit()}
        />
      )}

      {task.type === "multi_choice" && (
        <>
          <div className="option-grid">
            {shuffledOptions.map((option, index) => {
              const isSelected = selectedOptions.includes(option);
              return (
                <button
                  className={isSelected ? "option-button option-button--active" : "option-button"}
                  disabled={isSubmitting}
                  key={`${option}-${index}`}
                  type="button"
                  onClick={() => {
                    setSelectedOptions((current) => {
                      const nextSelected = current.includes(option)
                        ? current.filter((item) => item !== option)
                        : [...current, option];
                      return options.filter((item) => nextSelected.includes(item));
                    });
                  }}
                >
                  {option}
                </button>
              );
            })}
          </div>
          <button className="primary-button" type="button" disabled={isSubmitting || !selectedOptions.length} onClick={submitSelectedOptions}>
            <Send size={18} />
            Отправить
          </button>
        </>
      )}

      {task.type === "order" && (
        <>
          <div className="order-list">
            {orderedItems.map((item, index) => (
              <div className="order-item" key={`${item}-${index}`}>
                <span>{item}</span>
                <div>
                  <button className="icon-button" type="button" disabled={index === 0 || isSubmitting} onClick={() => setOrderedItems(moveItem(orderedItems, index, index - 1))} title="Выше">
                    <ArrowUp size={16} />
                  </button>
                  <button className="icon-button" type="button" disabled={index === orderedItems.length - 1 || isSubmitting} onClick={() => setOrderedItems(moveItem(orderedItems, index, index + 1))} title="Ниже">
                    <ArrowDown size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button className="primary-button" type="button" disabled={isSubmitting || !orderedItems.length} onClick={() => void submit(orderedItems.join("|"))}>
            <Send size={18} />
            Проверить порядок
          </button>
        </>
      )}

      {status && (
        <div className={isCorrect ? "task-status task-status--success" : "task-status"}>
          {isCorrect ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
          <span>{status}</span>
        </div>
      )}
    </section>
  );
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function shuffleItems<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }
  return result;
}

function splitMultiAnswer(value: string | null | undefined): string[] {
  return (value ?? "").split("|").map((item) => item.trim()).filter(Boolean);
}

function AnswerForm({
  answer,
  isSubmitting,
  setAnswer,
  submit,
}: {
  answer: string;
  isSubmitting: boolean;
  setAnswer: (value: string) => void;
  submit: () => void;
}) {
  return (
    <div className="answer-row">
      <input value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Ответ" />
      <button className="primary-button" type="button" onClick={submit} disabled={isSubmitting || !answer.trim()}>
        <Send size={18} />
        Отправить
      </button>
    </div>
  );
}
