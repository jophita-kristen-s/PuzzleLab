(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const puzzles = {
    easy: [
      "530070000","600195000","098000060","800060003","400803001","700020006","060000280","000419005","000080079"
    ],
    medium: [
      "000260701","680070090","190004500","820100040","004602900","050003028","009300074","040050036","703018000"
    ],
    hard: [
      "100007090","030020008","009600500","005300900","010080002","600004000","300000010","040000007","007000300"
    ]
  };
  let board = [], original = [], selected = null, difficulty = "easy", startTime = Date.now(), timerHandle = null;
  let solver = null, solverSteps = [], solverIndex = 0, attempts = 0, backtracks = 0, notes = [], solving = false, dailyMode = false;
  const pad = $("#number-pad"), boardEl = $("#sudoku-board");
  const formatBoard = (rows) => rows.join("").split("").map(Number);
  const rowStrings = (flat) => Array.from({length:9}, (_,r) => flat.slice(r*9,r*9+9).join(""));
  const clone = (arr) => arr.slice();

  function puzzleFor(level) {
    const rows = puzzles[level] || puzzles.easy;
    return formatBoard(rows);
  }
  function isValid(b, index, n) {
    const row = Math.floor(index/9), col = index%9;
    for(let c=0;c<9;c++) if(c!==col && b[row*9+c]===n) return false;
    for(let r=0;r<9;r++) if(r!==row && b[r*9+col]===n) return false;
    const sr=Math.floor(row/3)*3, sc=Math.floor(col/3)*3;
    for(let r=sr;r<sr+3;r++) for(let c=sc;c<sc+3;c++) {
      const i=r*9+c; if(i!==index && b[i]===n) return false;
    }
    return true;
  }
  function conflicts(b) {
    const bad = new Set();
    for(let i=0;i<81;i++) if(b[i]) {
      for(let j=i+1;j<81;j++) if(b[j]===b[i]) {
        const ri=Math.floor(i/9), ci=i%9, rj=Math.floor(j/9), cj=j%9;
        if(ri===rj || ci===cj || (Math.floor(ri/3)===Math.floor(rj/3)&&Math.floor(ci/3)===Math.floor(cj/3))) {bad.add(i);bad.add(j);}
      }
    }
    return bad;
  }
  function addNote(title, detail) {
    notes.unshift({title, detail, time:new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})});
    notes = notes.slice(0,5); renderNotes();
  }
  function renderNotes() {
    const el=$("#session-notes");
    if(!notes.length) {el.innerHTML='<div class="empty-note"><span>✧</span><div><strong>No moves logged yet</strong><p>Try a number or start the solver to build your session history.</p></div></div>';return;}
    el.innerHTML=notes.map(n=>`<div class="note-row"><span class="note-bullet"></span><div><strong>${escapeHtml(n.title)}</strong><small>${escapeHtml(n.detail)} · ${n.time}</small></div></div>`).join("");
  }
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function showToast(msg) {
    const t=$("#toast");t.textContent=msg;t.classList.add("show");clearTimeout(showToast.timeout);showToast.timeout=setTimeout(()=>t.classList.remove("show"),2200);
  }
  function updateStats() {
    const filled=board.filter(Boolean).length;
    $("#filled-count").textContent=`${filled} / 81`;
    $("#stat-difficulty").textContent=difficulty[0].toUpperCase()+difficulty.slice(1);
    $("#attempts").textContent=attempts.toLocaleString();
    $("#backtracks").textContent=backtracks.toLocaleString();
    $("#stat-backtracks").textContent=backtracks.toLocaleString();
    $("#steps-count").textContent=solverIndex.toLocaleString();
  }
  function renderBoard(highlight=null) {
    boardEl.innerHTML="";
    const bad=conflicts(board);
    for(let i=0;i<81;i++){
      const btn=document.createElement("button");btn.type="button";btn.className="cell";btn.setAttribute("role","gridcell");
      btn.setAttribute("aria-label",`Row ${Math.floor(i/9)+1}, column ${i%9+1}${board[i]?`, value ${board[i]}`:", empty"}`);
      btn.textContent=board[i]||"";
      if(original[i])btn.classList.add("given");
      if(bad.has(i))btn.classList.add("conflict");
      if(selected!==null) {
        const r=Math.floor(i/9),c=i%9,sr=Math.floor(selected/9),sc=selected%9;
        if(r===sr||c===sc||(Math.floor(r/3)===Math.floor(sr/3)&&Math.floor(c/3)===Math.floor(sc/3)))btn.classList.add("related");
        if(i===selected)btn.classList.add("selected");
        if(board[selected] && board[i]===board[selected])btn.classList.add("same-number");
      }
      if(highlight && highlight.index===i)btn.classList.add("solver-current");
      else if(highlight && highlight.tried && highlight.tried.includes(i))btn.classList.add("solver-tried");
      if(highlight && highlight.solved && board[i] && !original[i])btn.classList.add("solved");
      btn.addEventListener("click",()=>{selected=i;renderBoard();renderPad();});
      boardEl.appendChild(btn);
    }
    updateStats();
  }
  function renderPad() {
    pad.innerHTML="";
    for(let n=1;n<=9;n++){
      const b=document.createElement("button");b.className="number-key";b.textContent=n;b.type="button";
      b.disabled=selected===null || (selected!==null && original[selected]!==0);
      b.addEventListener("click",()=>putNumber(n));pad.appendChild(b);
    }
  }
  function renderAll(highlight=null){renderBoard(highlight);renderPad();}
  function putNumber(n) {
    if(selected===null){showToast("Select an empty cell first.");return;}
    if(original[selected]){showToast("Given numbers are locked.");return;}
    if(solving){showToast("Reset the solver before editing.");return;}
    board[selected]=n;
    resetSolverState(false);
    renderAll();
    const bad=conflicts(board);
    if(bad.has(selected)){ $("#board-message").textContent="That number conflicts with a row, column, or 3×3 box.";addNote("Conflict detected",`Placed ${n} in row ${Math.floor(selected/9)+1}, column ${selected%9+1}; check its peers.`);}
    else {$("#board-message").textContent=`Placed ${n}. Keep checking the row, column, and 3×3 box.`;addNote("Number placed",`Placed ${n} in row ${Math.floor(selected/9)+1}, column ${selected%9+1}.`);}
    renderPad();
  }
  function resetSolverState(clearMessage=true) {
    solver=null;solverSteps=[];solverIndex=0;attempts=0;backtracks=0;solving=false;
    $$(".flow-step").forEach((el,i)=>{el.classList.toggle("active",i===0);el.querySelector(".flow-check").textContent=i===0?"●":"○";});
    $("#reason-step").textContent="READY";
    $("#reason-text").innerHTML='Press <b>Step through</b> to watch the solver make a decision. Each step reveals one part of the search process.';
    $("#step-solve").textContent="▷ Step through";
    if(clearMessage)$("#board-message").textContent="Solver reset. Select a cell, then choose a number.";
    updateStats();
  }
  function newPuzzle(level=difficulty, fromDaily=false) {
    difficulty=level;dailyMode=fromDaily;
    board=puzzleFor(level);original=clone(board);selected=null;startTime=Date.now();notes=[];
    resetSolverState();renderAll();addNote("Puzzle loaded",`${level[0].toUpperCase()+level.slice(1)} puzzle ready to play.`);
    $("#difficulty").value=level;$("#board-message").textContent=fromDaily?"Daily challenge loaded. Good luck!":"Select a cell, then choose a number. Given numbers are locked.";
    updateStats();
  }
  function findEmpty(b){for(let i=0;i<81;i++)if(b[i]===0)return i;return -1;}
  // Build a deterministic sequence of solver events. Each event is a snapshot,
  // allowing the UI to replay placements and backtracking without mutating user state.
  function buildSolverSteps(source) {
    const work=clone(source), events=[];let tries=0,backs=0;
    function snapshot(type,index,n,detail,phase,tried=[]) {
      events.push({type,index,n,detail,phase,tried:tried.slice(),board:clone(work),attempts:tries,backtracks:backs});
    }
    function search() {
      const idx=findEmpty(work);
      if(idx===-1){snapshot("done",-1,0,"Every cell is filled and all constraints are satisfied.","done");return true;}
      snapshot("find",idx,0,`Found an empty cell at row ${Math.floor(idx/9)+1}, column ${idx%9+1}.`,"find");
      const rejected=[];
      for(let n=1;n<=9;n++){
        tries++;
        snapshot("try",idx,n,`Testing ${n} at row ${Math.floor(idx/9)+1}, column ${idx%9+1}.`,"try",rejected);
        if(isValid(work,idx,n)){
          work[idx]=n;
          snapshot("place",idx,n,`${n} does not conflict with this cell's row, column, or 3×3 box.`,"check",rejected);
          if(search())return true;
          work[idx]=0;backs++;
          snapshot("backtrack",idx,n,`${n} led to a dead end. Undo it and test another candidate.`,"back",rejected);
        } else {
          rejected.push(idx);
          snapshot("reject",idx,n,`${n} violates a Sudoku constraint here, so the solver skips it.`,"check",rejected);
        }
      }
      return false;
    }
    const solved=search();
    return {events,solved,finalBoard:work,attempts:tries,backtracks:backs};
  }
  function setFlow(phase) {
    const map={find:0,try:1,check:2,back:3,done:3};
    $$(".flow-step").forEach((el,i)=>{el.classList.toggle("active",i===(map[phase]??0));el.querySelector(".flow-check").textContent=i===(map[phase]??0)?"●":(i<(map[phase]??0)?"✓":"○");});
  }
  function startSolver() {
    if(conflicts(board).size){showToast("Fix conflicting numbers before solving.");$("#board-message").textContent="The board contains conflicting numbers. Resolve red cells first.";return;}
    const result=buildSolverSteps(board);
    if(!result.solved){showToast("This board has no solution.");$("#board-message").textContent="No solution found for this board.";return;}
    solver=result;solverSteps=result.events;solverIndex=0;attempts=0;backtracks=0;solving=true;
    $("#board-message").textContent="Solver prepared. Step through the decisions or solve instantly.";
    $("#reason-text").innerHTML='Solver is ready. Press <b>Step through</b> to inspect its first decision.';
    $("#reason-step").textContent="READY";renderAll();
    addNote("Solver prepared",`${solverSteps.length} replay events generated for this board.`);
  }
  function stepSolver() {
    if(!solver)startSolver();
    if(!solver)return;
    if(solverIndex>=solverSteps.length){showToast("Solver replay is complete.");return;}
    const e=solverSteps[solverIndex++];
    board=clone(e.board);attempts=e.attempts;backtracks=e.backtracks;
    setFlow(e.phase);
    $("#reason-step").textContent=`STEP ${solverIndex}`;
    $("#reason-text").textContent=e.detail;
    $("#step-solve").textContent=solverIndex>=solverSteps.length?"✓ Replay complete":"▷ Next step";
    $("#board-message").textContent=e.type==="done"?"Solved! All cells satisfy the Sudoku rules.":e.detail;
    renderAll({index:e.index,tried:e.tried,solved:e.type==="done"});
    addNote(e.type==="backtrack"?"Backtrack":e.type==="place"?"Candidate accepted":e.type==="reject"?"Candidate rejected":e.type==="done"?"Puzzle solved":"Solver step",e.detail);
    if(e.type==="done"){solving=false;showToast("Puzzle solved — nice work!");}
  }
  function solveInstant() {
    if(!solver)startSolver();if(!solver)return;
    board=clone(solver.finalBoard);solverIndex=solverSteps.length;attempts=solver.attempts;backtracks=solver.backtracks;solving=false;
    setFlow("done");$("#reason-step").textContent="COMPLETE";$("#reason-text").textContent=`Solved successfully after ${attempts} candidate attempts and ${backtracks} backtracks. The counts reflect this solver's search order.`;
    $("#step-solve").textContent="✓ Replay complete";$("#board-message").textContent="Solved! Use Reset solver to replay the reasoning, or start a new puzzle.";
    renderAll({solved:true});addNote("Puzzle solved",`${attempts} candidate attempts · ${backtracks} backtracks.`);showToast("Puzzle solved!");
  }
  function resetSolver() {
    board=clone(original);selected=null;resetSolverState();renderAll();$("#board-message").textContent="Board restored to its starting puzzle.";addNote("Board restored","Returned to the original puzzle.");
  }
  function checkBoard() {
    const bad=conflicts(board);
    if(bad.size){renderAll();$("#board-message").textContent=`Found conflicts affecting ${bad.size} cells. Red cells share a number in a row, column, or box.`;showToast("Some numbers conflict.");return;}
    if(board.every(Boolean)){const valid=board.every((n,i)=>original[i]||isValid(board,i,n));if(valid){$("#board-message").textContent="Excellent! The completed grid satisfies the Sudoku constraints.";showToast("Valid completed Sudoku!");addNote("Board verified","The filled grid satisfies the Sudoku constraints.");}else showToast("Check the board again.");}
    else {$("#board-message").textContent="No current conflicts. There are still empty cells to fill.";showToast("No conflicts found so far.");}
  }
  function benchmark() {
    if(conflicts(board).size){showToast("Resolve conflicts before benchmarking.");return;}
    const t=performance.now(),result=buildSolverSteps(board),ms=(performance.now()-t).toFixed(2);
    $("#benchmark-result").innerHTML=result.solved?`<b>Completed.</b> ${result.attempts.toLocaleString()} candidate attempts · ${result.backtracks.toLocaleString()} backtracks · ${ms} ms measured locally. <span class="muted">Runtime varies by device and browser.</span>`:"No solution found for the current board.";
    showToast("Benchmark finished.");addNote("Benchmark completed",`${result.attempts} attempts, ${result.backtracks} backtracks, ${ms} ms.`);
  }
  function dailyLevel() {
    const d=new Date();const seed=(d.getFullYear()*372+(d.getMonth()+1)*31+d.getDate())%3;
    return ["easy","medium","hard"][seed];
  }
  function setupTimer() {
    if(timerHandle)clearInterval(timerHandle);
    timerHandle=setInterval(()=>{const sec=Math.floor((Date.now()-startTime)/1000);$("#timer").textContent=`${String(Math.floor(sec/60)).padStart(2,"0")}:${String(sec%60).padStart(2,"0")}`;},1000);
  }
  function switchView(view) {
    $$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
    $$(".view").forEach(v=>v.classList.toggle("active",v.id===`view-${view}`));
    $("#crumb-title").textContent=({sudoku:"Sudoku Studio",lab:"Algorithm Lab",challenge:"Daily Challenge"})[view]||"Sudoku Studio";
    if(view==="challenge")$("#challenge-date").textContent=new Date().toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"});
  }
  $$(".nav-item").forEach(b=>b.addEventListener("click",()=>switchView(b.dataset.view)));
  $("#difficulty").addEventListener("change",e=>newPuzzle(e.target.value));
  $("#new-puzzle").addEventListener("click",()=>newPuzzle(difficulty));
  $("#erase").addEventListener("click",()=>{if(selected===null){showToast("Select a cell first.");return;}if(original[selected]){showToast("Given numbers are locked.");return;}board[selected]=0;resetSolverState(false);renderAll();$("#board-message").textContent="Cell cleared.";addNote("Cell cleared",`Cleared row ${Math.floor(selected/9)+1}, column ${selected%9+1}.`);});
  $("#check").addEventListener("click",checkBoard);
  $("#solve").addEventListener("click",solveInstant);
  $("#step-solve").addEventListener("click",stepSolver);
  $("#reset-solver").addEventListener("click",resetSolver);
  $("#run-benchmark").addEventListener("click",benchmark);
  $("#start-challenge").addEventListener("click",()=>{newPuzzle(dailyLevel(),true);switchView("sudoku");showToast("Today's puzzle is ready.");});
  $("#theme-toggle").addEventListener("click",()=>{document.body.classList.toggle("light");showToast(document.body.classList.contains("light")?"Light theme enabled":"Dark theme enabled");});
  document.addEventListener("keydown",e=>{
    if(e.key>="1"&&e.key<="9"&&!["INPUT","SELECT","TEXTAREA"].includes(document.activeElement.tagName))putNumber(Number(e.key));
    if(e.key==="Backspace"||e.key==="Delete"){if(selected!==null&&!original[selected]&&!solving){board[selected]=0;renderAll();}}
    if(e.key==="ArrowRight"||e.key==="ArrowLeft"||e.key==="ArrowDown"||e.key==="ArrowUp"){
      if(selected===null)return;e.preventDefault();
      selected=Math.max(0,Math.min(80,selected+({ArrowRight:1,ArrowLeft:-1,ArrowDown:9,ArrowUp:-9}[e.key])));renderAll();
    }
  });
  newPuzzle("easy");setupTimer();
})();
