import { db } from './src/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const seedData = async () => {
  console.log('Seeding NDRF Database...');

  try {
    // 1. Add Sample Resources
    const resources = [
      {
        name: 'NDRF Team 01 (Delhi)',
        type: 'team',
        status: 'active',
        location: { lat: 28.6139, lng: 77.2090 },
        lastUpdated: serverTimestamp(),
        details: 'Specialized in urban search and rescue.'
      },
      {
        name: 'Rescue Boat Alpha',
        type: 'vehicle',
        status: 'on_standby',
        location: { lat: 22.5726, lng: 88.3639 },
        lastUpdated: serverTimestamp(),
        details: 'High-speed rescue boat for flood response.'
      },
      {
        name: 'Medical Kit Delta',
        type: 'equipment',
        status: 'en_route',
        location: { lat: 19.0760, lng: 72.8777 },
        lastUpdated: serverTimestamp(),
        details: 'Advanced life support equipment.'
      }
    ];

    for (const res of resources) {
      await addDoc(collection(db, 'resources'), res);
      console.log(`Added resource: ${res.name}`);
    }

    // 2. Add Sample Alerts
    const alerts = [
      {
        title: 'Flood Warning: West Bengal',
        message: 'Heavy rainfall expected in coastal areas. All teams on high alert.',
        severity: 'high',
        timestamp: serverTimestamp(),
        active: true
      },
      {
        title: 'Earthquake Drill',
        message: 'Scheduled drill for HQ staff at 14:00 today.',
        severity: 'low',
        timestamp: serverTimestamp(),
        active: true
      }
    ];

    for (const alert of alerts) {
      await addDoc(collection(db, 'alerts'), alert);
      console.log(`Added alert: ${alert.title}`);
    }

    console.log('Database Seeding Complete!');
  } catch (error) {
    console.error('Error seeding database:', error);
  }
};

seedData();
