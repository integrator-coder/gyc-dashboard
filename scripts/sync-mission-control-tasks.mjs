#!/usr/bin/env node
/**
 * Auto-sync Mission Control taskboard from workspace activity
 * 
 * Scans workspace for:
 * - IMPLEMENTATION-LOG.md files (project tracking)
 * - TODO-*.md files (daily task lists)
 * - memory/*.md files (daily logs with task updates)
 * 
 * Updates mission-control-taskboard.json with:
 * - New tasks found in implementation logs
 * - Status changes (To Do → In Progress → Done)
 * - Progress notes from daily logs
 * 
 * Run daily via cron to keep Mission Control in sync with actual work
 */

import fs from 'fs/promises';
import path from 'path';

const WORKSPACE = process.env.OPENCLAW_WORKSPACE || `${process.env.HOME}/.openclaw/workspace`;
const TASKBOARD_PATH = path.join(WORKSPACE, 'memory/mission-control-taskboard.json');
const TASK_UPDATES_PATH = path.join(WORKSPACE, 'memory/task-updates.md');

async function readTaskboard() {
  try {
    const raw = await fs.readFile(TASKBOARD_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { columns: { backlog: [], inProgress: [], review: [], done: [] }, updatedAt: null };
  }
}

async function writeTaskboard(data) {
  data.updatedAt = new Date().toISOString();
  await fs.writeFile(TASKBOARD_PATH, JSON.stringify(data, null, 2), 'utf8');
}

async function appendTaskUpdate(message) {
  const timestamp = new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto' });
  const line = `\n- [${timestamp}] ${message}`;
  try {
    await fs.appendFile(TASK_UPDATES_PATH, line, 'utf8');
  } catch {
    await fs.writeFile(TASK_UPDATES_PATH, `# Task Updates\n${line}`, 'utf8');
  }
}

function generateId(columns) {
  const allIds = Object.values(columns).flat().map((t) => t.id || '');
  const nums = allIds.map((id) => parseInt(id.replace('mc-', ''), 10)).filter((n) => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 79; // Start after existing
  return `mc-${max + 1}`;
}

async function scanImplementationLogs() {
  const tasks = [];
  const projects = ['gyc-dashboard', 'gyc-recon', 'agent-network'];
  
  for (const project of projects) {
    const logPath = path.join(WORKSPACE, project, 'IMPLEMENTATION-LOG.md');
    try {
      const content = await fs.readFile(logPath, 'utf8');
      
      // Parse task patterns from implementation logs
      // Look for: ## Task Name / ### Phase / [ ] checkbox items
      const taskMatches = content.matchAll(/^##\s+(.+?)$/gm);
      const checkboxMatches = content.matchAll(/^-\s+\[( |x)\]\s+(.+?)$/gm);
      
      for (const match of taskMatches) {
        const title = match[1].trim();
        // Skip headers like "Phase 1", "Phase 2"
        if (!title.match(/^Phase|^Week|^Priority|^Success/i)) {
          tasks.push({
            title,
            description: '',
            project: project.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            status: 'To Do',
            priority: 'medium',
            source: 'implementation-log'
          });
        }
      }
      
      for (const match of checkboxMatches) {
        const isDone = match[1] === 'x';
        const title = match[2].trim();
        tasks.push({
          title,
          description: '',
          project: project.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          status: isDone ? 'Done' : 'To Do',
          priority: 'medium',
          source: 'implementation-log-checkbox'
        });
      }
    } catch (err) {
      // File doesn't exist or not readable - skip
    }
  }
  
  return tasks;
}

async function scanTodoFiles() {
  const tasks = [];
  try {
    const files = await fs.readdir(WORKSPACE);
    const todoFiles = files.filter(f => f.match(/^TODO-\d{4}-\d{2}-\d{2}\.md$/));
    
    for (const file of todoFiles) {
      const content = await fs.readFile(path.join(WORKSPACE, file), 'utf8');
      const date = file.match(/TODO-(\d{4}-\d{2}-\d{2})/)[1];
      
      // Parse checkbox items
      const checkboxMatches = content.matchAll(/^-\s+\[( |x)\]\s+(.+?)$/gm);
      
      for (const match of checkboxMatches) {
        const isDone = match[1] === 'x';
        const title = match[2].trim();
        
        // Skip trivial tasks
        if (title.length > 15 && !title.match(/coffee|break|lunch/i)) {
          tasks.push({
            title,
            description: `From daily to-do: ${date}`,
            project: 'Daily Tasks',
            status: isDone ? 'Done' : 'To Do',
            priority: 'medium',
            source: 'todo-file',
            date
          });
        }
      }
    }
  } catch (err) {
    // No TODO files or not readable
  }
  
  return tasks;
}

async function scanMemoryFiles() {
  const updates = [];
  try {
    const memoryDir = path.join(WORKSPACE, 'memory');
    const files = await fs.readdir(memoryDir);
    const recentFiles = files
      .filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.md$/))
      .sort()
      .slice(-7); // Last 7 days
    
    for (const file of recentFiles) {
      const content = await fs.readFile(path.join(memoryDir, file), 'utf8');
      const date = file.replace('.md', '');
      
      // Look for completed work markers
      const completedMatches = content.matchAll(/✅|completed|finished|done|shipped/gi);
      const progressMatches = content.matchAll(/in progress|working on|started/gi);
      
      if (completedMatches) {
        updates.push({
          date,
          type: 'completion',
          count: Array.from(completedMatches).length
        });
      }
      
      if (progressMatches) {
        updates.push({
          date,
          type: 'progress',
          count: Array.from(progressMatches).length
        });
      }
    }
  } catch (err) {
    // Memory files not accessible
  }
  
  return updates;
}

async function mergeTasks(board, newTasks) {
  const cols = board.columns || {};
  let addedCount = 0;
  let updatedCount = 0;
  
  for (const task of newTasks) {
    // Check if task already exists (fuzzy match on title)
    const existingTask = Object.values(cols)
      .flat()
      .find(t => t.title?.toLowerCase().includes(task.title.toLowerCase().substring(0, 30)));
    
    if (existingTask) {
      // Update status if changed
      const oldStatus = existingTask.status;
      if (oldStatus !== task.status) {
        // Move to new column
        const oldColKey = Object.keys(cols).find(k => cols[k].includes(existingTask));
        const newColKey = task.status === 'Done' ? 'done' : task.status === 'In Progress' ? 'inProgress' : 'backlog';
        
        cols[oldColKey] = cols[oldColKey].filter(t => t.id !== existingTask.id);
        if (!cols[newColKey]) cols[newColKey] = [];
        cols[newColKey].unshift(existingTask);
        existingTask.status = task.status;
        
        await appendTaskUpdate(`🔄 Task status changed: "${existingTask.title}" (${oldStatus} → ${task.status})`);
        updatedCount++;
      }
    } else {
      // Add new task
      const newTask = {
        id: generateId(cols),
        title: task.title,
        description: task.description || '',
        owner: 'Wall·E',
        priority: task.priority || 'medium',
        project: task.project || 'General',
        nextSteps: [],
        status: task.status || 'To Do',
        createdAt: new Date().toISOString(),
        source: task.source
      };
      
      const colKey = task.status === 'Done' ? 'done' : task.status === 'In Progress' ? 'inProgress' : 'backlog';
      if (!cols[colKey]) cols[colKey] = [];
      cols[colKey].unshift(newTask);
      
      await appendTaskUpdate(`➕ New task detected: "${newTask.title}" — Source: ${task.source}`);
      addedCount++;
    }
  }
  
  board.columns = cols;
  return { addedCount, updatedCount };
}

async function main() {
  console.log('🔄 Syncing Mission Control taskboard from workspace activity...\n');
  
  const board = await readTaskboard();
  
  // Scan different sources
  console.log('📂 Scanning implementation logs...');
  const implTasks = await scanImplementationLogs();
  console.log(`   Found ${implTasks.length} tasks in implementation logs`);
  
  console.log('📋 Scanning TODO files...');
  const todoTasks = await scanTodoFiles();
  console.log(`   Found ${todoTasks.length} tasks in TODO files`);
  
  console.log('📝 Scanning memory files for activity...');
  const memoryUpdates = await scanMemoryFiles();
  console.log(`   Found activity in ${memoryUpdates.length} recent days`);
  
  // Merge all tasks
  const allTasks = [...implTasks, ...todoTasks];
  console.log(`\n🔀 Merging ${allTasks.length} tasks into taskboard...`);
  
  const { addedCount, updatedCount } = await mergeTasks(board, allTasks);
  
  // Write updated board
  await writeTaskboard(board);
  
  console.log('\n✅ Sync complete:');
  console.log(`   • ${addedCount} new tasks added`);
  console.log(`   • ${updatedCount} tasks updated`);
  console.log(`   • Updated at: ${board.updatedAt}`);
  
  // Summary
  const total = Object.values(board.columns).flat().length;
  console.log(`\n📊 Current taskboard:`)
  console.log(`   • Backlog: ${board.columns.backlog?.length || 0}`);
  console.log(`   • In Progress: ${board.columns.inProgress?.length || 0}`);
  console.log(`   • Review: ${board.columns.review?.length || 0}`);
  console.log(`   • Done: ${board.columns.done?.length || 0}`);
  console.log(`   • Total: ${total}`);
}

main().catch(console.error);
