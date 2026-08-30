export const JUDGE_PROFILES = {
  'JM001': {
    id: 'JM001',
    group: 'Group 1',
    names: [
      'Dr. P V RAMANA',
      'Dr. Chetan O Yadav',
      'Prof. Sanjay Natvarlal Patel',
      'Dr. K P Mredula'
    ],
    namesText: 'Dr. P V RAMANA, Dr. Chetan O Yadav, Prof. Sanjay Natvarlal Patel, Dr. K P Mredula',
    location: 'CE Dept. First Floor, F1'
  },
  'JM002': {
    id: 'JM002',
    group: 'Group 2',
    names: [
      'Dr. Dipen S Shah',
      'Dr. Nilay Narendrakumar Shah',
      'Dr Jonita Roman',
      'Prof. Priyal R. Patel'
    ],
    namesText: 'Dr. Dipen S Shah, Dr. Nilay Narendrakumar Shah, Dr Jonita Roman, Prof. Priyal R. Patel',
    location: 'CE Dept. First Floor, F2'
  },
  'JM003': {
    id: 'JM003',
    group: 'Group 3',
    names: [
      'Dr. Neha Soni',
      'Prof. Rimi V Gupta',
      'Prof. Viral S Patel',
      'Dr. Jigar B. Sura'
    ],
    namesText: 'Dr. Neha Soni, Prof. Rimi V Gupta, Prof. Viral S Patel, Dr. Jigar B. Sura',
    location: 'CE Dept. First Floor, F3'
  },
  'JM004': {
    id: 'JM004',
    group: 'Group 4',
    names: [
      'Prof. Jayna B. Shah',
      'Dr. Pratik Shah',
      'Prof. Keyur Suthar',
      'Dr. Bhavini Pandya'
    ],
    namesText: 'Prof. Jayna B. Shah, Dr. Pratik Shah, Prof. Keyur Suthar, Dr. Bhavini Pandya',
    location: 'CE Dept. First Floor, F4'
  },
  'JM005': {
    id: 'JM005',
    group: 'Group 5',
    names: [
      'Dr. Mala H Mehta',
      'Prof. Nisha S Velani',
      'Prof. Hetal Ranjitsingh Chauhan',
      'Dr. C D Kotwal'
    ],
    namesText: 'Dr. Mala H Mehta, Prof. Nisha S Velani, Prof. Hetal Ranjitsingh Chauhan, Dr. C D Kotwal',
    location: 'CE Dept. First Floor, F5'
  },
  'JM006': {
    id: 'JM006',
    group: 'Group 6',
    names: [
      'Prof. Jigneshkumar Narendrakumar Patel',
      'Prof. Rashmin B Prajapati',
      'Dr. Shrina Patel',
      'Prof. Rakesh Gajjar'
    ],
    namesText: 'Prof. Jigneshkumar Narendrakumar Patel, Prof. Rashmin B Prajapati, Dr. Shrina Patel, Prof. Rakesh Gajjar',
    location: 'CE Dept. First Floor, F6'
  },
  'JM007': {
    id: 'JM007',
    group: 'Group 7',
    names: [
      'Dr. Falguni N Patel',
      'Dr. Minal Patel',
      'Dr. Nirali Rathod',
      'Dr. Saurabh Patel'
    ],
    namesText: 'Dr. Falguni N Patel, Dr. Minal Patel, Dr. Nirali Rathod, Dr. Saurabh Patel',
    location: 'CE Dept. Second Floor, S2'
  },
  'JM008': {
    id: 'JM008',
    group: 'Group 8',
    names: [
      'Dr. Niranjan M. Trivedi',
      'Dr. Ajaysinh Devendrasinh Rathod',
      'Prof. Nisha V Shah',
      'Prof. Amit Patel'
    ],
    namesText: 'Dr. Niranjan M. Trivedi, Dr. Ajaysinh Devendrasinh Rathod, Prof. Nisha V Shah, Prof. Amit Patel',
    location: 'CE Dept. Second Floor, S1'
  },
  'JM009': {
    id: 'JM009',
    group: 'Group 9',
    names: [
      'Prof. Parul V Bakaraniya',
      'Dr. Barkha M. Joshi',
      'Prof. Arpit Mehta',
      'Prof. Nirav Patel'
    ],
    namesText: 'Prof. Parul V Bakaraniya, Dr. Barkha M. Joshi, Prof. Arpit Mehta, Prof. Nirav Patel',
    location: 'CE Dept. Ground Floor, G3'
  },
  'JM010': {
    id: 'JM010',
    group: 'Group 10',
    names: [
      'Prof. Keyur N Upadhyay',
      'Prof. Amit I Chaudhari',
      'Prof. Pradish D Dadhania',
      'Prof. Ronak Roy'
    ],
    namesText: 'Prof. Keyur N Upadhyay, Prof. Amit I Chaudhari, Prof. Pradish D Dadhania, Prof. Ronak Roy',
    location: 'CE Dept. Ground Floor, G1'
  },
  'JM011': {
    id: 'JM011',
    group: 'Group 11',
    names: [
      'Special Jury Panel / Evaluators'
    ],
    namesText: 'Special Jury Panel / Evaluators',
    location: 'CE Dept. Central Hall'
  }
};

export const getJudgeProfile = (loginId) => {
  if (!loginId) return null;
  const key = loginId.trim().toUpperCase();
  return JUDGE_PROFILES[key] || null;
};
