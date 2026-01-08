
import axios from 'axios';
import { SimBriefOFP } from '../types';

export const fetchSimBriefData = async (username: string): Promise<SimBriefOFP> => {
  try {
    // Note: SimBrief XML Fetcher returns JSON if &json=1 is appended
    const response = await axios.get(`https://www.simbrief.com/api/xml.fetcher.php?username=${username}&json=1`);
    const data = response.data;

    return {
      origin: data.origin.icao_code,
      destination: data.destination.icao_code,
      paxCount: parseInt(data.weights.pax_count),
      blockFuel: parseFloat(data.fuel.plan_ramp),
      callsign: data.atc.callsign,
      aircraft: data.aircraft.icaocode,
      plannedEte: parseInt(data.times.est_time_enroute),
      // Fix: Added missing plannedDeparture property by converting SimBrief unix timestamp to milliseconds
      plannedDeparture: parseInt(data.times.sched_out) * 1000
    };
  } catch (error) {
    console.error('Error fetching SimBrief OFP:', error);
    throw new Error('Could not fetch OFP. Check your username.');
  }
};
