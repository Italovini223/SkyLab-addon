
import axios from 'axios';
import { SimBriefOFP } from '../types';

/**
 * Fetches the latest Operational Flight Plan (OFP) from SimBrief.
 * Uses URI encoding to prevent 400 errors caused by special characters in usernames.
 */
export const fetchSimBriefData = async (username: string): Promise<SimBriefOFP> => {
  if (!username || username.trim() === '') {
    throw new Error('Username is required.');
  }

  const encodedUser = encodeURIComponent(username.trim());
  
  try {
    // SimBrief API requires either 'username' or 'userid'. 
    // We use &json=1 for JSON output. 
    // If the request fails with 400, it's often due to an invalid or missing username.
    const response = await axios.get(`https://www.simbrief.com/api/xml.fetcher.php?username=${encodedUser}&json=1`);
    
    const data = response.data;

    // SimBrief sometimes returns a 200 OK but with an error object inside the JSON
    if (data.fetch && data.fetch.status === 'error') {
      throw new Error(data.fetch.error || 'SimBrief OFP not found for this user.');
    }

    // Defensive check for required nested structures
    if (!data.origin || !data.destination || !data.times || !data.weights) {
      throw new Error('Received invalid data format from SimBrief. Ensure you have a generated OFP.');
    }

    return {
      origin: data.origin.icao_code || 'XXXX',
      destination: data.destination.icao_code || 'XXXX',
      paxCount: parseInt(data.weights.pax_count) || 0,
      blockFuel: parseFloat(data.fuel.plan_ramp) || 0,
      callsign: data.atc.callsign || 'SKY123',
      aircraft: data.aircraft.icaocode || 'A20N',
      plannedEte: parseInt(data.times.est_time_enroute) || 3600,
      // Convert Unix timestamp to milliseconds. Default to now if missing.
      plannedDeparture: data.times.sched_out ? parseInt(data.times.sched_out) * 1000 : Date.now()
    };
  } catch (error: any) {
    console.error('Error fetching SimBrief OFP:', error);
    
    if (error.response) {
      // The request was made and the server responded with a status code outside of 2xx
      if (error.response.status === 400) {
        throw new Error('SimBrief API Error (400): Invalid request. Ensure the username is correct and an OFP has been generated.');
      }
      throw new Error(`SimBrief API Error (${error.response.status}): ${error.response.data?.fetch?.error || 'Unknown error'}`);
    } else if (error.request) {
      // The request was made but no response was received
      throw new Error('No response from SimBrief servers. Check your internet connection.');
    } else {
      // Something happened in setting up the request that triggered an Error
      throw new Error(error.message || 'An unexpected error occurred while fetching flight data.');
    }
  }
};
