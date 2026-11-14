"use client";

import { useState } from "react";
import type { Step } from "@excel-guru/grader";
import { Grid } from "@/components/grid/Grid";

export function StepView({ step, onReady, onEditStart, setSelectRef }: {
  step: Step;
  onReady: (input: string) => void;
  onEditStart?: () => void;
  setSelectRef?: (ref: string) => void;
}) {
  const [choice, setChoice] = useState<number | null>(null);
  const [input, setInput] = useState("");
  if (step.type === "select") return <>
    <Grid key={step.id} grid={step.grid} highlightCells={step.highlightCells} selectMode onSelectionChange={(ref) => setSelectRef?.(ref)} />
    <p className="pl-hint">Select the requested cell or range in the grid.</p>
  </>;
  if (step.type === "mcq") return <fieldset className="pl-options"><legend className="pl-prompt">{step.prompt}</legend>{step.options.map((option, i) => <label key={option}><input type="radio" name={`choice-${step.id}`} checked={choice === i} onChange={() => { setChoice(i); onEditStart?.(); onReady(String(i)); }} />{option}</label>)}</fieldset>;
  if (step.type === "picture" || step.type === "project") return <div className="pl-card">
    {step.type === "picture" ? <img className="pl-step-image" src={step.image} alt="Question" /> : <a href={step.file} download>Download project file</a>}
    <label className="pl-prompt" htmlFor={`answer-${step.id}`}>{step.prompt}</label>
    <div className="pl-free-answer"><input id={`answer-${step.id}`} value={input} onChange={(e) => { setInput(e.target.value); onReady(e.target.value); onEditStart?.(); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onReady(input); } }} /></div>
  </div>;
  if (step.type === "shortcut") return <section className="pl-card"><p className="pl-prompt">{step.prompt}</p><p className="pl-soon">Coming soon</p></section>;
  if (step.type === "formula") return <Grid key={step.id} grid={step.grid} targetCell={step.targetCell} highlightCells={step.highlightCells} onEditStart={onEditStart} />;
  return <section className="pl-card"><p className="pl-prompt">{step.text}</p></section>;
}
