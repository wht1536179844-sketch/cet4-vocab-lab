import React from "react";
import { X, BookOpen, Zap, Volume2, Repeat, CheckCircle2 } from "lucide-react";

export default function GuideModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>四级真题保姆级背词法 · 操作说明书</h2>
            <p>还原「中专过四六级 500+ 保姆经验帖（单词篇）」两步走核心方法</p>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body guide-steps">
          <div className="guide-step">
            <div className="gs-icon">
              <BookOpen size={18} />
            </div>
            <div>
              <h4>第一步：真题划词精读（先用 2026年6月 + 2025年真题老老实实过 5 套）</h4>
              <p>
                基础薄弱时先不做题，直接打开 <strong>2026年6月 第1套</strong>，对听力、选词填空、仔细阅读、作文翻译里的所有陌生单词<strong>单击查词 + 标黄加入自制词本</strong>（长篇阅读超纲词多可跳过）。遇整句翻译怪异时，用鼠标划选并点击右侧解析查看<strong>词组/固定搭配</strong>一并收入。
              </p>
            </div>
          </div>

          <div className="guide-step">
            <div className="gs-icon">
              <Repeat size={18} />
            </div>
            <div>
              <h4>第二步：次日必过一轮 + 2:1 复习新学比例</h4>
              <p>
                真题里今天捞出来的生词，<strong>第二天一定要过一轮</strong>！在「备考速刷」中切换「首页 2:1 模式」，始终保持 <strong>复习量 : 新学量 = 2 : 1</strong>（如 100 复习 : 50 新学，冲刺可 200:100），先稳住昨天背过的词。
              </p>
            </div>
          </div>

          <div className="guide-step">
            <div className="gs-icon">
              <Zap size={18} />
            </div>
            <div>
              <h4>第三步：备考速刷 + 错词本（快速、大量、多轮）</h4>
              <p>
                不要在一个卡住的词上反复死磕！速刷模式下点「认识」直接过，点「不会」闪现释义后<strong>直接记入错词本并推下一词</strong>，极大加速过词本速度，靠<strong>7天一轮、多轮重复</strong>把真题生词和「四级真题核心词 (1,162词)」刷熟。
              </p>
            </div>
          </div>

          <div className="guide-step">
            <div className="gs-icon">
              <Volume2 size={18} />
            </div>
            <div>
              <h4>第四步：细节原则（不拼写、不学音标、初期开外放）</h4>
              <p>
                不要浪费时间手抄拼写单词（作文靠模板词），没学过音标也能直接学；初期背新词本建议开启右上角<strong>「自动朗读」</strong>，听觉+视觉双重记忆更牢固。
              </p>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>
            <CheckCircle2 size={16} /> 知道了，开始从 2026年6月真题背单词
          </button>
        </div>
      </div>
    </div>
  );
}
