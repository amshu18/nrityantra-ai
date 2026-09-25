const KEY = "nrityaantra_guest";

export function isGuest(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function enableGuest() {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* ignore */
  }
}

export function disableGuest() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
