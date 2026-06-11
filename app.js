const fileInput = document.querySelector("#fileInput");
const pickFiles = document.querySelector("#pickFiles");
const loadSample = document.querySelector("#loadSample");
const dropZone = document.querySelector("#dropZone");
const trackList = document.querySelector("#trackList");
const outputText = document.querySelector("#outputText");
const summary = document.querySelector("#summary");
const copyOutput = document.querySelector("#copyOutput");
const clearAll = document.querySelector("#clearAll");
const copyStatus = document.querySelector("#copyStatus");
const offsetInput = document.querySelector("#offsetInput");
const formatSelect = document.querySelector("#formatSelect");
const includeRepeat = document.querySelector("#includeRepeat");
const repeatLabel = document.querySelector("#repeatLabel");

const sampleTracks = [
  { title: "Silver Bloom", duration: 133 },
  { title: "Color Me Close", duration: 164 },
  { title: "White Blue Heaven", duration: 178 },
  { title: "Crystal Veil", duration: 179 },
  { title: "Quiet Light", duration: 225 },
  { title: "Pastel Tide", duration: 200 },
  { title: "Hush of Clouds", duration: 203 },
  { title: "Whispered Mercy", duration: 187 },
  { title: "Dawn on Your Face", duration: 174 },
];

let tracks = [];
let audioContext;

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `track-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cleanTitle(fileName) {
  return fileName
    .replace(/\.[^/.]+$/, "")
    .replace(/^\s*\d+[\s._-]+/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatTime(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function parseTime(value) {
  const parts = value
    .trim()
    .split(":")
    .filter(Boolean)
    .map((part) => Number.parseInt(part, 10));

  if (parts.length === 0 || parts.some((part) => Number.isNaN(part))) {
    return 0;
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  return parts[0];
}

function getStartTimes() {
  let cursor = parseTime(offsetInput.value);

  return tracks.map((track) => {
    const start = cursor;
    cursor += track.duration;
    return start;
  });
}

function getTotalDuration() {
  return tracks.reduce((sum, track) => sum + track.duration, parseTime(offsetInput.value));
}

function getOutputLines() {
  const separator = formatSelect.value === "dash" ? " - " : " ";
  const starts = getStartTimes();

  const lines = tracks.map((track, index) => {
    const title = track.title.trim() || `Track ${index + 1}`;
    return `${formatTime(starts[index])}${separator}${title}`;
  });

  if (includeRepeat.checked && repeatLabel.value.trim()) {
    lines.push(`${formatTime(getTotalDuration())}${separator}${repeatLabel.value.trim()}`);
  }

  return lines;
}

function setStatus(message, isError = false) {
  copyStatus.textContent = message;
  copyStatus.classList.toggle("is-error", isError);
}

function render() {
  if (tracks.length === 0) {
    trackList.innerHTML = '<tr class="empty-row"><td colspan="5">오디오 파일을 넣으면 여기에 목록이 생깁니다.</td></tr>';
    summary.textContent = "아직 추가된 오디오 파일이 없습니다.";
    outputText.value = "";
    return;
  }

  const starts = getStartTimes();
  const totalDuration = getTotalDuration();

  summary.textContent = `${tracks.length}곡 · 총 ${formatTime(totalDuration)}`;
  outputText.value = getOutputLines().join("\n");

  trackList.innerHTML = tracks
    .map(
      (track, index) => `
        <tr>
          <td class="time">${index + 1}</td>
          <td>
            <input
              class="title-input"
              type="text"
              value="${escapeHtml(track.title)}"
              data-action="title"
              data-index="${index}"
              aria-label="${index + 1}번 제목"
            >
          </td>
          <td class="time">${formatTime(track.duration)}</td>
          <td class="time">${formatTime(starts[index])}</td>
          <td>
            <div class="row-actions">
              <button class="secondary" type="button" data-action="up" data-index="${index}" ${index === 0 ? "disabled" : ""}>위</button>
              <button class="secondary" type="button" data-action="down" data-index="${index}" ${index === tracks.length - 1 ? "disabled" : ""}>아래</button>
              <button class="secondary" type="button" data-action="remove" data-index="${index}">삭제</button>
            </div>
          </td>
        </tr>
      `
    )
    .join("");
}

async function readDuration(file) {
  const context = getAudioContext();
  const buffer = await file.arrayBuffer();
  const decoded = await context.decodeAudioData(buffer.slice(0));
  return decoded.duration;
}

async function addFiles(fileList) {
  const files = [...fileList].filter((file) => file.type.startsWith("audio/"));

  if (files.length === 0) {
    setStatus("오디오 파일만 추가할 수 있습니다.", true);
    return;
  }

  setStatus(`${files.length}개 파일의 길이를 읽는 중입니다...`);

  for (const file of files) {
    try {
      const duration = await readDuration(file);
      tracks.push({
        id: createId(),
        title: cleanTitle(file.name),
        duration,
        fileName: file.name,
      });
    } catch (error) {
      setStatus(`${file.name} 파일 길이를 읽지 못했습니다. 브라우저가 지원하는 형식인지 확인해 주세요.`, true);
    }
  }

  render();
  setStatus("타임스탬프가 업데이트되었습니다.");
}

function moveTrack(from, to) {
  if (to < 0 || to >= tracks.length) {
    return;
  }

  const [track] = tracks.splice(from, 1);
  tracks.splice(to, 0, track);
  render();
}

function loadSampleTracks() {
  tracks = sampleTracks.map((track) => ({
    id: createId(),
    title: track.title,
    duration: track.duration,
    fileName: `${track.title}.mp3`,
  }));

  render();
  setStatus("샘플 플레이리스트를 불러왔습니다.");
}

pickFiles.addEventListener("click", () => fileInput.click());
loadSample.addEventListener("click", loadSampleTracks);

fileInput.addEventListener("change", (event) => {
  addFiles(event.target.files);
  fileInput.value = "";
});

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("is-over");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("is-over");
});

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("is-over");
  addFiles(event.dataTransfer.files);
});

trackList.addEventListener("input", (event) => {
  if (event.target.dataset.action !== "title") {
    return;
  }

  tracks[Number(event.target.dataset.index)].title = event.target.value;
  outputText.value = getOutputLines().join("\n");
});

trackList.addEventListener("click", (event) => {
  const button = event.target.closest("button");

  if (!button) {
    return;
  }

  const index = Number(button.dataset.index);
  const action = button.dataset.action;

  if (action === "up") {
    moveTrack(index, index - 1);
  }

  if (action === "down") {
    moveTrack(index, index + 1);
  }

  if (action === "remove") {
    tracks.splice(index, 1);
    render();
  }
});

offsetInput.addEventListener("input", render);
formatSelect.addEventListener("change", render);
includeRepeat.addEventListener("change", render);
repeatLabel.addEventListener("input", render);

copyOutput.addEventListener("click", async () => {
  if (!outputText.value.trim()) {
    setStatus("복사할 타임스탬프가 없습니다.", true);
    return;
  }

  try {
    await navigator.clipboard.writeText(outputText.value);
    setStatus("생성된 타임스탬프를 클립보드에 복사했습니다.");
  } catch (error) {
    outputText.select();
    document.execCommand("copy");
    setStatus("선택된 타임스탬프를 복사했습니다.");
  }
});

clearAll.addEventListener("click", () => {
  tracks = [];
  render();
  setStatus("목록을 비웠습니다.");
});

render();
