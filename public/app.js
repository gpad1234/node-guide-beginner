const lessonList = document.querySelector("#lesson-list");
const lessonCount = document.querySelector("#lesson-count");
const lessonTitle = document.querySelector("#lesson-title");
const lessonTransport = document.querySelector("#lesson-transport");
const lessonDescription = document.querySelector("#lesson-description");
const sourceName = document.querySelector("#source-name");
const sourceCode = document.querySelector("#source-code");
const conceptList = document.querySelector("#concept-list");
const output = document.querySelector("#output");
const runButton = document.querySelector("#run-button");
const runStatus = document.querySelector("#run-status");
const errorMessage = document.querySelector("#error-message");

let lessons = [];
let currentLessonId = "";

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error ?? result.output ?? `Request failed (${response.status}).`);
  }
  return result;
}

function setStatus(text, state = "") {
  runStatus.textContent = text;
  runStatus.className = `run-status ${state}`.trim();
}

async function selectLesson(id) {
  const lesson = lessons.find((item) => item.id === id);
  if (!lesson) return;

  currentLessonId = id;
  document.querySelectorAll(".lesson-button").forEach((button) => {
    if (button.dataset.id === id) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });

  const index = lessons.indexOf(lesson) + 1;
  lessonTransport.textContent = `LESSON ${String(index).padStart(2, "0")} · ${lesson.transport.toUpperCase()}`;
  lessonTitle.textContent = lesson.title;
  lessonDescription.textContent = lesson.description;
  sourceName.textContent = `examples/${lesson.file}`;
  conceptList.replaceChildren(...lesson.concepts.map((concept) => {
    const item = document.createElement("li");
    item.textContent = concept;
    return item;
  }));
  errorMessage.hidden = true;
  output.textContent = "Choose “Run example” to start this client and server.";
  setStatus("READY");

  try {
    const result = await requestJson(`/api/source?id=${encodeURIComponent(id)}`);
    sourceCode.textContent = result.source;
  } catch (error) {
    sourceCode.textContent = "";
    errorMessage.textContent = error.message;
    errorMessage.hidden = false;
  }
}

function renderLessons() {
  lessonCount.textContent = String(lessons.length).padStart(2, "0");
  lessonList.replaceChildren(...lessons.map((lesson, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "lesson-button";
    button.dataset.id = lesson.id;
    button.innerHTML = `<span class="lesson-number">${String(index + 1).padStart(2, "0")}</span><span class="lesson-name"></span>`;
    button.querySelector(".lesson-name").textContent = lesson.title;
    button.addEventListener("click", () => selectLesson(lesson.id));
    return button;
  }));
}

runButton.addEventListener("click", async () => {
  if (!currentLessonId) return;

  runButton.disabled = true;
  errorMessage.hidden = true;
  output.textContent = "Starting the server and client…";
  setStatus("RUNNING", "running");

  try {
    const result = await requestJson("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: currentLessonId })
    });
    output.textContent = result.output || "The example completed without output.";
    setStatus("SUCCESS", "success");
  } catch (error) {
    output.textContent = "";
    errorMessage.textContent = error.message;
    errorMessage.hidden = false;
    setStatus("FAILED", "error");
  } finally {
    runButton.disabled = false;
  }
});

try {
  lessons = await requestJson("/api/examples");
  renderLessons();
  if (lessons.length) {
    runButton.disabled = false;
    await selectLesson(lessons[0].id);
  }
} catch (error) {
  lessonTitle.textContent = "Could not load the guide";
  sourceCode.textContent = "";
  errorMessage.textContent = error.message;
  errorMessage.hidden = false;
}
