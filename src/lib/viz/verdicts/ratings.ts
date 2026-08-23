import type { Rule } from './rules';

export const RATINGS: Rule[] = [
	{
		id: 'generous',
		title: 'The Generous',
		when: (t) => (t.meanRating ?? 0) >= 3.8,
		detail: (t) => `You averaged ★ ${(t.meanRating ?? 0).toFixed(1)} across the year.`
	},
	{
		id: 'abstainer',
		title: 'The Abstainer',
		when: (t) => t.ratedShare <= 0.2 && t.films >= 20,
		detail: (t) => `${t.films} films logged, ${t.rated} rated.`
	},
	{
		id: 'metronome',
		title: 'The Metronome',
		when: (t) => t.pairShare >= 0.7 && t.rated >= 30,
		detail: (t) =>
			`${Math.round(t.pairShare * t.rated)} of your ${t.rated} ratings fell inside a single half-star pair.`
	},
	{
		id: 'purist',
		title: 'The Purist',
		when: (t) => t.fiveStarShare <= 0.02 && t.rated >= 50,
		detail: (t) => {
			const fives = Math.round(t.fiveStarShare * t.rated);
			return `${fives} five-star ${fives === 1 ? 'rating' : 'ratings'} in ${t.rated} rated films.`;
		}
	},
	{
		id: 'sceptic',
		title: 'The Sceptic',
		when: (t) => (t.meanRating ?? 5) <= 2.7 && t.rated >= 25,
		detail: (t) => `Average rating ★ ${(t.meanRating ?? 0).toFixed(1)} across ${t.rated} films.`
	},
	{
		id: 'enthusiast',
		title: 'The Enthusiast',
		when: (t) => t.likedShare >= 0.5 && t.films >= 25,
		detail: (t) => `You hearted ${t.likedCount} of ${t.films} films.`
	},
	{
		id: 'withholder',
		title: 'The Withholder',
		when: (t) => t.likedCount === 0 && t.films >= 40,
		detail: (t) => `${t.films} films, no hearts.`
	},
	{
		id: 'barometer',
		title: 'The Barometer',
		when: (t) => (t.crowdMeanAbs ?? 9) <= 0.55 && t.crowdCount >= 30,
		detail: (t) =>
			`On average your ratings sat ${(t.crowdMeanAbs ?? 0).toFixed(1)} stars from the crowd, across ${t.crowdCount} films.`
	},
	{
		id: 'contrarian',
		title: 'The Contrarian',
		when: (t) => (t.crowdMeanSigned ?? 0) <= -0.7 && t.crowdCount >= 30,
		detail: (t) =>
			`You rated ${t.crowdCount} films against the crowd, on average ${Math.abs(t.crowdMeanSigned ?? 0).toFixed(1)} stars below them.`
	},
	{
		id: 'salvager',
		title: 'The Salvager',
		when: (t) => (t.metascoreMean ?? 100) <= 48 && t.metascoreCount >= 20,
		detail: (t) =>
			`Average Metascore ${Math.round(t.metascoreMean ?? 0)} across ${t.metascoreCount} scored films, below the midpoint of the scale.`
	},
	{
		id: 'selector',
		title: 'The Selector',
		when: (t) => (t.metascoreMean ?? 0) >= 74 && t.metascoreCount >= 20,
		detail: (t) =>
			`Average Metascore ${Math.round(t.metascoreMean ?? 0)} across ${t.metascoreCount} scored films, firmly in critics' favour.`
	}
];
