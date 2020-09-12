let events = [];

function handleClientLoad() {
	gapi.load('client:auth2', initClient);
}

function findPrevious() {
	const now = Date.now();
	let max = null;
	let maxTime = 0;

	for (const event of events) {
		const end = new Date(event.end.dateTime).getTime();
		if (end <= now && (!max || end >= maxTime)) {
			max = event;
			maxTime = end;
		}
	}

	return max;
}

function findCurrent() {
	const now = Date.now();
	for (const event of events) {
		const start = new Date(event.start.dateTime).getTime();
		const end = new Date(event.end.dateTime).getTime();
		if (start <= now && end >= now) {
			return event;
		}
	}

	return null;
}

function anyRemaining() {
	const current = findCurrent();
	const currentEnd = current ? new Date(current.end.dateTime).getTime() : null;

	const now = Date.now();
	for (const event of events) {
		const start = new Date(event.start.dateTime).getTime();
		const end = new Date(event.end.dateTime).getTime();
		if (start >= now) {
			return true;
		}
	}

	return false;
}

function findNext() {
	const current = findCurrent();
	const currentEnd = current ? new Date(current.end.dateTime).getTime() : null;

	const now = Date.now();
	for (const event of events) {
		const start = new Date(event.start.dateTime).getTime();
		const end = new Date(event.end.dateTime).getTime();
		if (start >= now && (!current || currentEnd == start)) {
			return event;
		}
	}

	return null;
}

function setText(elem, text) {
	if (elem.innerText != text) {
		elem.innerText = text;
	}
}

function setLeft(elem, end) {
	const now = Date.now();
	const left = Math.round((new Date(end).getTime() - now) / 1000);
	const hours = Math.floor(left / 3600);
	const minutes = Math.floor((left % 3600) / 60);
	const seconds = left % 60;

	let text = `${minutes.toString().padStart(2, '0')}m${seconds.toString().padStart(2, '0')}s`;

	if (hours > 0) {
		text = `${hours.toString()}h${text}`;
	}

	setText(elem, text);

	if (left < 30) {
		document.body.classList.remove("blinkSlow");
		document.body.classList.add("blinkFast");
	} else if (left < 60) {
		document.body.classList.remove("blinkFast");
		document.body.classList.add("blinkSlow");
	} else {
		document.body.classList.remove("blinkSlow", "blinkFast");
	}
}

function setProgress(elem, start, end) {
	const elapsed = Date.now() - new Date(start).getTime();
	const duration = new Date(end).getTime() - new Date(start).getTime();
	const perc = Math.round(elapsed / duration * 100000) / 1000;
	elem.style.background = `-webkit-linear-gradient(left, #e28659 ${perc.toString()}%, transparent ${perc.toString()}%)`;
}

function timezoneOffset() {
	const offset = new Date().getTimezoneOffset();
	return `${offset > 0 ? '-' : '+'}${Math.floor(offset / 60).toString().padStart(2, '0')}:${(offset % 60).toString().padStart(2, '0')}`;
}

function render() {
	const curElem = document.getElementById("current");
	const curName = document.getElementById("currentName");
	const curLeft = document.getElementById("currentLeft");
	const nextElem = document.getElementById("next");
	const nextName = document.getElementById("nextName");

	const current = findCurrent();
	const prev = findPrevious();
	const next = findNext();

	if (current) {
		// Currently in an event
		curElem.classList.remove("break");
		curElem.classList.add("event");
		setText(curName, current.summary);
		setProgress(curElem, current.start.dateTime, current.end.dateTime);
		setText(curLeft, "");
		document.body.classList.remove("blinkSlow", "blinkFast");
	} else {
		// Currently between/before/after events
		curElem.classList.remove("event");
		curElem.classList.add("break");

		if (prev && next) {
			setText(curName, "😎 Break");
			setProgress(curElem, prev.end.dateTime, next.start.dateTime);
			setLeft(curLeft, next.start.dateTime);
		} else if (next) {
			setText(curName, "😎 Break");
			curElem.style.background = null;
			setLeft(curLeft, next.start.dateTime);
		} else {
			setText(curName, "✅ Done!");
			curElem.style.background = null;
			setText(curLeft, "");
			document.body.classList.remove("blinkSlow", "blinkFast");
		}
	}

	if (next) {
		nextElem.classList.remove("break");
		nextElem.classList.add("event");
		setText(nextName, next.summary);
	} else if (current) {
		nextElem.classList.remove("event");
		nextElem.classList.add("break");
		if (anyRemaining()) {
			setText(nextName, "😎 Break");
		} else {
			setText(nextName, "✅ Done!");
		}
	} else {
		nextElem.classList.remove("break");
		nextElem.classList.remove("event");
		setText(nextName, "");
	}
}

function loadEvents() {
	const tz = timezoneOffset();
	const today = new Date();
	const date = `${today.getFullYear().toString()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
	return gapi.client.calendar.events.list({
		'calendarId': 'primary',
		'timeMin': `${date}T00:00:00${tz}`,
		'timeMax': `${date}T23:59:59${tz}`,
		'showDeleted': false,
		'singleEvents': true,
		'maxResults': 250,
		'orderBy': 'startTime',
	});
}

function initClient() {
	gapi.client.init({
		apiKey: 'AIzaSyDzNMBbLqQoSCMiug_7UbUrgaAvnoyzYYU',
		clientId: '969085949455-0vtpi7g173fi63akr1o2eakp9nm1bp4i.apps.googleusercontent.com',
		discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
		scope: 'https://www.googleapis.com/auth/calendar.events.readonly',
		ux_mode: 'redirect',
	}).then(() => {
		if (gapi.auth2.getAuthInstance().isSignedIn.get()) {
			return loadEvents();
		} else {
			gapi.auth2.getAuthInstance().signIn();
			return;
		}
	}).then((response) => {
		events = response.result.items;
		setInterval(() => render(), 250);
		setInterval(() => {
			loadEvents().then((response) => {
				events = response.result.items;
			});
		}, 5 * 60 * 1000);
	});
}

