<script>
	import ChevronsLeft from '@lucide/svelte/icons/chevrons-left';
	import ChevronsRight from '@lucide/svelte/icons/chevrons-right';
	import CloudDownload from '@lucide/svelte/icons/cloud-download';
	import Close from '@lucide/svelte/icons/x';
	import { supabase } from '$lib/supabase';
	import { requireUser } from '$lib/auth-guard';

	const startYear = 2026;
	const endYear = 2028;

	const monthNames = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December'
	];

	let showSubmissionsModal = $state(false);
	let selectedDay = $state(null);
	let selectedDateKey = $state('');
	let submissionStatus = $state({ tbm: false, ppe: false, hkp: false });
	let submissionsLoading = $state(false);
	let submissionsError = $state('');
	let dayStatusByDate = $state({});
	let monthStatusError = $state('');

	// @ts-ignore
	const months = [];
	for (let y = startYear; y <= endYear; y++) {
		for (let m = 0; m < 12; m++) {
			months.push({ year: y, month: m });
		}
	}

	const today = new Date();

	const currentIndex = months.findIndex(
		(m) => m.year === today.getFullYear() && m.month === today.getMonth()
	);

	let index = $state(currentIndex !== -1 ? currentIndex : 0);

	function prev() {
		if (index > 0) index -= 1;
	}

	function next() {
		if (index < months.length - 1) index += 1;
	}

	function isToday(day, year, month) {
		if (!day) return false;
		const today = new Date();
		return today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
	}

	function getDateKey(year, month, day) {
		const mm = String(month + 1).padStart(2, '0');
		const dd = String(day).padStart(2, '0');
		return `${year}-${mm}-${dd}`;
	}

	function formatSelectedDate(day, year, month) {
		if (!day) return '';
		const date = new Date(year, month, day);
		const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' });
		const dateStr = date.toLocaleDateString('en-GB');
		return `${weekday}, ${dateStr}`;
	}

	function localDayRangeISO(year, month, day) {
		const start = new Date(year, month, day, 0, 0, 0, 0);
		const end = new Date(year, month, day, 23, 59, 59, 999);
		return { startISO: start.toISOString(), endISO: end.toISOString() };
	}

	function monthRangeISO(year, month) {
		const start = new Date(year, month, 1, 0, 0, 0, 0);
		const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
		return { startISO: start.toISOString(), endISO: end.toISOString() };
	}

	// @ts-ignore
	function getWeeks(year, month) {
		const first = new Date(year, month, 1);
		const daysInMonth = new Date(year, month + 1, 0).getDate();
		const weeks = [];
		let week = new Array(7).fill(null);

		let dayOfWeek = (first.getDay() + 6) % 7;
		let dayCounter = 1;

		for (let i = dayOfWeek; i < 7 && dayCounter <= daysInMonth; i++) {
			week[i] = dayCounter++;
		}
		weeks.push(week.slice());

		while (dayCounter <= daysInMonth) {
			week = new Array(7).fill(null);
			for (let i = 0; i < 7 && dayCounter <= daysInMonth; i++) {
				week[i] = dayCounter++;
			}
			weeks.push(week.slice());
		}

		while (weeks.length < 6) {
			weeks.push(new Array(7).fill(null));
		}

		return weeks;
	}

	const openSubmissionsModal = (day) => {
		if (!day) return;
		const year = months[index].year;
		const month = months[index].month;
		selectedDay = day;
		selectedDateKey = getDateKey(year, month, day);
		loadSubmissionStatus(day, year, month);
		showSubmissionsModal = true;
	};

	const handleCellKeydown = (event, day) => {
		if (!day) return;
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			openSubmissionsModal(day);
		}
	};

	const closeSubmissionsModal = () => {
		showSubmissionsModal = false;
	};

	const loadSubmissionStatus = async (day, year, month) => {
		submissionsLoading = true;
		submissionsError = '';
		submissionStatus = { tbm: false, ppe: false, hkp: false };

		try {
			const auth = await requireUser();
			if (!auth) return;

			const { supabase, user } = auth;

			if (!user) {
				submissionsError = 'Please sign in to view submissions.';
				return;
			}

			const { startISO, endISO } = localDayRangeISO(year, month, day);

			const [tbmRes, ppeRes, hkpRes] = await Promise.all([
				supabase
					.from('tbm_submissions')
					.select('id')
					.eq('created_by', user.id)
					.gte('created_at', startISO)
					.lte('created_at', endISO)
					.limit(1),
				supabase
					.from('ppe_submissions')
					.select('id')
					.eq('created_by', user.id)
					.gte('created_at', startISO)
					.lte('created_at', endISO)
					.limit(1),
				supabase
					.from('hkp_submissions')
					.select('id')
					.eq('created_by', user.id)
					.gte('created_at', startISO)
					.lte('created_at', endISO)
					.limit(1)
			]);

			if (tbmRes.error) throw tbmRes.error;
			if (ppeRes.error) throw ppeRes.error;
			if (hkpRes.error) throw hkpRes.error;

			const status = {
				tbm: (tbmRes.data ?? []).length > 0,
				ppe: (ppeRes.data ?? []).length > 0,
				hkp: (hkpRes.data ?? []).length > 0
			};
			submissionStatus = status;
			dayStatusByDate = { ...dayStatusByDate, [getDateKey(year, month, day)]: status };
		} catch (error) {
			submissionsError = error?.message ?? String(error);
		} finally {
			submissionsLoading = false;
		}
	};

	const loadMonthStatuses = async (year, month) => {
		monthStatusError = '';
		dayStatusByDate = {};

		try {
			const auth = await requireUser();
			if (!auth) return;

			const { supabase, user } = auth;

			if (!user) {
				monthStatusError = 'Please sign in to view submissions.';
				return;
			}

			const { startISO, endISO } = monthRangeISO(year, month);

			const [tbmRes, ppeRes, hkpRes] = await Promise.all([
				supabase
					.from('tbm_submissions')
					.select('created_at')
					.eq('created_by', user.id)
					.gte('created_at', startISO)
					.lte('created_at', endISO),
				supabase
					.from('ppe_submissions')
					.select('created_at')
					.eq('created_by', user.id)
					.gte('created_at', startISO)
					.lte('created_at', endISO),
				supabase
					.from('hkp_submissions')
					.select('created_at')
					.eq('created_by', user.id)
					.gte('created_at', startISO)
					.lte('created_at', endISO)
			]);

			if (tbmRes.error) throw tbmRes.error;
			if (ppeRes.error) throw ppeRes.error;
			if (hkpRes.error) throw hkpRes.error;

			const statusMap = {};

			const mark = (row, key) => {
				const date = new Date(row.created_at);
				const dateKey = getDateKey(date.getFullYear(), date.getMonth(), date.getDate());
				statusMap[dateKey] = statusMap[dateKey] || { tbm: false, ppe: false, hkp: false };
				statusMap[dateKey][key] = true;
			};

			(tbmRes.data ?? []).forEach((row) => mark(row, 'tbm'));
			(ppeRes.data ?? []).forEach((row) => mark(row, 'ppe'));
			(hkpRes.data ?? []).forEach((row) => mark(row, 'hkp'));

			dayStatusByDate = statusMap;
		} catch (error) {
			monthStatusError = error?.message ?? String(error);
		}
	};

	$effect(() => {
		const year = months[index].year;
		const month = months[index].month;
		loadMonthStatuses(year, month);
	});
</script>

<h1 class="title">Calendar View</h1>

<div class="project-box">
	<p>
		Note: Only submitting Tool Box Meeting, PPE Visual Inspections and Housekeeping forms will
		become Working Day (Starting from December 2025)
	</p>

	<div class="download">
		<button class="button-download"><CloudDownload /><span>Excel</span></button>
	</div>

	<div class="calendar">
		<div class="calendar-header">
			<button class="nav" onclick={prev} disabled={index === 0}><ChevronsLeft /></button>
			<div class="month-label">{monthNames[months[index].month]} {months[index].year}</div>
			<button class="nav" onclick={next} disabled={index === months.length - 1}
				><ChevronsRight /></button
			>
		</div>

		<div class="weekdays">
			<div><span class="wd-full">Monday</span><span class="wd-short">Mon</span></div>
			<div><span class="wd-full">Tuesday</span><span class="wd-short">Tue</span></div>
			<div><span class="wd-full">Wednesday</span><span class="wd-short">Wed</span></div>
			<div><span class="wd-full">Thursday</span><span class="wd-short">Thu</span></div>
			<div><span class="wd-full">Friday</span><span class="wd-short">Fri</span></div>
			<div><span class="wd-full">Saturday</span><span class="wd-short">Sat</span></div>
			<div><span class="wd-full">Sunday</span><span class="wd-short">Sun</span></div>
		</div>

		{#each getWeeks(months[index].year, months[index].month) as week}
			<div class="week">
				{#each week as day}
					{@const dateKey = day ? getDateKey(months[index].year, months[index].month, day) : ''}
					<div
						class="cell"
						class:today={isToday(day, months[index].year, months[index].month)}
						class:clickable={day}
						role="button"
						tabindex={day ? 0 : -1}
						onclick={() => openSubmissionsModal(day)}
						onkeydown={(event) => handleCellKeydown(event, day)}
					>
						{#if day}
							{#if dateKey && dayStatusByDate[dateKey]}
								<div
									class="cell-status"
									class:status-ok={dayStatusByDate[dateKey].tbm &&
										dayStatusByDate[dateKey].ppe &&
										dayStatusByDate[dateKey].hkp}
									class:status-bad={!(
										dayStatusByDate[dateKey].tbm &&
										dayStatusByDate[dateKey].ppe &&
										dayStatusByDate[dateKey].hkp
									)}
								>
									{dayStatusByDate[dateKey].tbm &&
									dayStatusByDate[dateKey].ppe &&
									dayStatusByDate[dateKey].hkp
										? 'Working'
										: 'No Working'}
								</div>
							{:else}
								<div class="no-working cell-status">No Working</div>
							{/if}
							<div class="day-num">{String(day).padStart(2, '0')}</div>
						{/if}
					</div>
				{/each}
			</div>
		{/each}
	</div>

	{#if showSubmissionsModal}
		<div class="modal-backdrop" role="presentation">
			<div class="modal" role="dialog" aria-modal="true" aria-label="Submissions Summary">
				<div class="modal-actions">
					<h3>{formatSelectedDate(selectedDay, months[index].year, months[index].month)}</h3>
					<button class="modal-close" onclick={closeSubmissionsModal}><Close size={18} /></button>
				</div>
				<div class="modal-body">
					{#if submissionsError}
						<p class="status-error">{submissionsError}</p>
					{:else if submissionsLoading}
						<p>Loading...</p>
					{:else}
						<div class="submissions-info">
							<p>Tool Box Meeting (e-TBM):</p>
							<p class:status-ok={submissionStatus.tbm} class:status-bad={!submissionStatus.tbm}>
								{submissionStatus.tbm ? 'Submitted' : 'Not submitted'}
							</p>
						</div>
						<div class="submissions-info">
							<p>PPE Visual Inspections (e-PPE):</p>
							<p class:status-ok={submissionStatus.ppe} class:status-bad={!submissionStatus.ppe}>
								{submissionStatus.ppe ? 'Submitted' : 'Not submitted'}
							</p>
						</div>
						<div class="submissions-info">
							<p>Housekeeping (e-HKP):</p>
							<p class:status-ok={submissionStatus.hkp} class:status-bad={!submissionStatus.hkp}>
								{submissionStatus.hkp ? 'Submitted' : 'Not submitted'}
							</p>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	* {
		font-family: Arial, Helvetica, sans-serif;
		font-size: 14px;
		color: #091747;
	}

	button {
		background-color: #064c6dd7;
		color: #ffffff;
		border: none;
		font-size: small;
		padding: 6px 14px;
		border-radius: 4px;
		cursor: pointer;
	}

	.button-download {
		background-color: #31b647;
		width: 150px;
		height: 40px;
		margin: 10px 0 0 auto;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
	}

	.button-download span {
		color: #ffffff;
	}

	.button-download:hover {
		background-color: #31b647bd;
	}

	.calendar {
		margin-top: 10px;
		border: 1px solid #b0b0b0;
		border-radius: 6px;
		overflow: hidden;
	}

	.calendar-header {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding: 10px 0;
		font-weight: bold;
	}

	.calendar-header .month-label {
		font-size: 16px;
	}

	.cell {
		min-height: 90px;
		padding: 8px;
		border-right: 1px solid #b0b0b0;
		border-bottom: 1px solid #b0b0b0;
		position: relative;
		background: #fff;
	}

	.cell.clickable {
		cursor: pointer;
	}

	.cell.today {
		box-shadow: inset 0 0 0 2px #091747;
	}

	.cell:last-child {
		border-right: none;
	}

	.day-num {
		position: absolute;
		bottom: 6px;
		right: 8px;
		font-weight: bold;
		color: #064c6dd7;
	}

	.cell-status {
		text-align: center;
	}

	.download {
		display: flex;
		align-items: flex-end;
	}

	.modal-actions {
		display: flex;
		justify-content: space-between;
	}

	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(9, 23, 71, 0.45);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 32px 20px;
		z-index: 10;
	}

	.modal-body {
		margin-top: 15px;
	}

	.modal {
		position: relative;
		width: min(400px, 100%);
		height: 200px;
		overflow: auto;
		background: #ffffff;
		border-radius: 8px;
		margin: auto;
		padding: 20px;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
	}

	.modal-close {
		position: absolute;
		top: 20px;
		right: 12px;
		background: transparent;
		border: none;
		cursor: pointer;
		padding: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #091747;
	}

	.modal-close:hover {
		background: rgba(0, 0, 0, 0.05);
		border-radius: 50%;
	}

	.modal h3 {
		margin: 0 0 16px;
		font-size: 16px;
		font-weight: bold;
	}

	.nav {
		background: none;
		color: #064c6dd7;
		border: none;
		font-size: 18px;
		cursor: pointer;
		padding: 6px 12px;
	}

	.nav:disabled {
		color: #b0b0b0;
		cursor: default;
	}

	.no-working {
		color: #e60000;
		font-weight: bold;
		text-align: center;
		margin-top: 6px;
	}

	.project-box {
		margin: 10px;
		border-radius: 4px;
		padding: 10px;
		font-size: 14px;
	}

	.submissions-info {
		display: flex;
		justify-content: space-between;
		margin-bottom: 5px;
	}

	.status-ok {
		color: #0f8f2f;
		font-weight: bold;
	}

	.status-bad {
		color: #c62828;
		font-weight: bold;
	}

	.status-error {
		color: #c62828;
		font-weight: bold;
	}

	.title {
		font-size: 35px;
		font-weight: bold;
		margin-bottom: 20px;
		padding: 0 10px;
	}

	.weekdays {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		background: #f7fbff;
		border-top: 1px solid #b0b0b0;
		border-bottom: 1px solid #b0b0b0;
	}

	.weekdays > div {
		padding: 10px;
		text-align: center;
		font-weight: bold;
		color: #091747;
	}

	.week {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
	}

	.wd-short {
		display: none;
	}

	@media (max-width: 1024px) {
		.title {
			font-size: 24px;
			margin-bottom: 15px;
		}

		.project-box p {
			word-break: break-word;
			overflow-wrap: anywhere;
		}

		.calendar {
			overflow-x: auto;
		}

		.calendar-header {
			flex-wrap: wrap;
			gap: 8px;
		}

		.calendar-header .month-label {
			font-size: 15px;
			text-align: center;
			width: 100%;
		}

		.cell {
			min-height: 70px;
			padding: 6px;
		}

		.cell-status {
			font-size: 12px;
			word-break: break-word;
		}

		.day-num {
			font-size: 12px;
		}

		.download {
			justify-content: flex-start;
		}

		.button-download {
			margin-left: 0;
			width: 100%;
		}

		.modal {
			height: auto;
			max-height: 80vh;
		}

		.submissions-info {
			gap: 10px;
		}
	}
	@media (max-width: 600px) {
		.title {
			font-size: 22px;
		}

		.calendar-header {
			flex-wrap: nowrap;
			justify-content: space-between;
			gap: 8px;
			padding: 10px 12px;
		}

		.weekdays > div {
			padding: 6px 2px;
			font-size: 11px;
		}

		.week {
			grid-template-columns: repeat(7, minmax(44px, 1fr));
		}

		.wd-full {
			display: none;
		}

		.wd-short {
			display: inline;
		}

		.cell {
			min-height: 60px;
			padding: 4px;
		}

		.cell-status {
			font-size: 10px;
			line-height: 1.1;
			padding: 2px 0;
		}

		.day-num {
			font-size: 11px;
			right: 4px;
			bottom: 4px;
		}

		.nav {
			font-size: 16px;
			padding: 4px 8px;
		}

		.no-working {
			margin-top: 2px;
		}

		.modal {
			width: 100%;
			padding: 16px;
		}

		.modal h3 {
			font-size: 14px;
		}

		.submissions-info {
			align-items: center;
		}

		.submissions-info p {
			font-size: 13px;
		}
	}
</style>
