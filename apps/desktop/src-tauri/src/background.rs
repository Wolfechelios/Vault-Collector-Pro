use crate::db::{open_database, intelligence::SearchRepository};
use std::{
    path::PathBuf,
    sync::{Arc, Condvar, Mutex, atomic::{AtomicBool, Ordering}},
    thread::{self, JoinHandle},
    time::Duration,
};

pub struct BackgroundIndexer {
    stopped: Arc<AtomicBool>,
    wake: Arc<(Mutex<bool>, Condvar)>,
    thread: Mutex<Option<JoinHandle<()>>>,
}

impl BackgroundIndexer {
    pub fn start(database_path: PathBuf) -> Self {
        let stopped = Arc::new(AtomicBool::new(false));
        let wake = Arc::new((Mutex::new(true), Condvar::new()));
        let worker_stopped = Arc::clone(&stopped);
        let worker_wake = Arc::clone(&wake);
        let thread = thread::spawn(move || {
            let Ok(mut connection) = open_database(&database_path) else { return; };
            while !worker_stopped.load(Ordering::Acquire) {
                match SearchRepository::process_reindex_queue(&mut connection, 100) {
                    Ok(100) => continue,
                    Ok(_) => {},
                    Err(error) => eprintln!("background search indexing failed: {error}"),
                }
                let (lock, signal) = &*worker_wake;
                let pending = lock.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
                let (mut pending, _) = signal.wait_timeout_while(pending, Duration::from_secs(2), |value| !*value)
                    .unwrap_or_else(|poisoned| poisoned.into_inner());
                *pending = false;
            }
        });
        Self { stopped, wake, thread: Mutex::new(Some(thread)) }
    }

    pub fn notify(&self) {
        let (lock, signal) = &*self.wake;
        let mut pending = lock.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        *pending = true;
        signal.notify_one();
    }
}

impl Drop for BackgroundIndexer {
    fn drop(&mut self) {
        self.stopped.store(true, Ordering::Release);
        self.notify();
        if let Some(thread) = self.thread.lock().unwrap_or_else(|poisoned| poisoned.into_inner()).take() {
            let _ = thread.join();
        }
    }
}
