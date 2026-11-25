"use client";

import {
  plCardClasses,
  plOptionsClasses,
} from "../player-styles";
import { useState } from "react";
import type { Step } from "@excel-guru/grader";
import { Grid } from "@/components/grid/Grid";
import { RichText } from "@/components/RichText";

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
    <p className="pl-hint text-muted text-ledger-sm">Select the requested cell or range in the grid.</p>
  </>;
  if (step.type === "mcq") return <fieldset className={`pl-options ${plOptionsClasses}`}><legend className="pl-prompt block m-0 text-ink text-[1.06rem] leading-[1.55]"><RichText text={step.prompt} /></legend>{step.options.map((option, i) => <label key={option}><input type="radio" name={`choice-${step.id}`} checked={choice === i} onChange={() => { setChoice(i); onEditStart?.(); onReady(String(i)); }} />{option}</label>)}</fieldset>;
  if (step.type === "picture" || step.type === "project") return <div className={`pl-card ${plCardClasses}`}>
    {step.type === "picture" ? <img className="pl-step-image block max-w-full h-auto m-[0_auto_var(--s4)] rounded-ledger-sm" src={step.image} alt="Question" /> : <a href={step.file} download>Download project file</a>}
    <label className="pl-prompt block m-0 text-ink text-[1.06rem] leading-[1.55]" htmlFor={`answer-${step.id}`}><RichText text={step.prompt} /></label>
    <div className="pl-free-answer flex flex-wrap gap-s2 mt-s3
          [&_input]:min-w-0 [&_input]:[flex:1] [&_input]:min-h-[46px] [&_input]:p-[10px_14px]
          [&_input]:[border:1px_solid_var(--border)] [&_input]:rounded-ledger [&_input]:bg-surface [&_input]:text-text
          [&_input]:[font:inherit] [&_input]:font-ledger-code
          [&_input:focus]:[outline:none] [&_input:focus]:border-primary
          [&_input:focus]:[box-shadow:0_0_0_3px_var(--primary-tint)]"><input id={`answer-${step.id}`} value={input} onChange={(e) => { setInput(e.target.value); onReady(e.target.value); onEditStart?.(); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onReady(input); } }} /></div>
  </div>;
  if (step.type === "shortcut") return <section className={`pl-card ${plCardClasses}`}><p className="pl-prompt block m-0 text-ink text-[1.06rem] leading-[1.55]"><RichText text={step.prompt} /></p><p className="pl-soon m-[var(--s3)_0_0] text-muted">Coming soon</p></section>;
  if (step.type === "formula") return <Grid key={step.id} grid={step.grid} targetCell={step.targetCell} highlightCells={step.highlightCells} onEditStart={onEditStart} />;
  return <section className={`pl-card ${plCardClasses}`}><p className="pl-prompt block m-0 text-ink text-[1.06rem] leading-[1.55]"><RichText text={step.text} /></p></section>;
}
