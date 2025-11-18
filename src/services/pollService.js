import { supabase } from "./supabase";

export async function getActivePolls() {
  const { data, error } = await supabase.rpc("get_active_polls");
  if (error) {
    console.error("Error fetching polls:", error);
    throw error;
  }

  const map = new Map();
  data.forEach((row) => {
    if (!map.has(row.poll_id)) {
      map.set(row.poll_id, {
        id: row.poll_id,
        question: row.question,
        created_at: row.created_at,
        options: [],
      });
    }
    if (row.option_id !== null) {
      map.get(row.poll_id).options.push({
        id: row.option_id,
        text: row.option_text,
        votes: row.votes ?? 0,
      });
    }
  });

  return [...map.values()];
}

export async function checkIfVoted(pollId, userHash) {
  try {
    const { data, error } = await supabase.rpc('has_user_voted', { 
      poll_id_param: pollId, 
      user_hash_param: userHash 
    });
    
    if (error) {
      console.error("Error checking vote status:", error);
      return false;
    }
    
    return data || false;
  } catch (error) {
    console.error("Error in checkIfVoted:", error);
    return false;
  }
}

export async function createPoll(question, options, createdBy) {
  if (!question || !question.trim()) {
    throw new Error("Poll question is required");
  }

  const validOptions = options.filter(opt => opt && opt.trim());
  if (validOptions.length < 2) {
    throw new Error("At least 2 options are required");
  }

  const { data: poll, error } = await supabase
    .from("polls")
    .insert([{ question: question.trim(), created_by: createdBy, active: true }])
    .select()
    .single();

  if (error) {
    console.error("Error creating poll:", error);
    throw error;
  }

  const formattedOptions = validOptions.map((text) => ({
    poll_id: poll.id,
    text: text.trim(),
    votes: 0,
  }));

  const { error: optionsError } = await supabase
    .from("poll_options")
    .insert(formattedOptions);

  if (optionsError) {
    console.error("Error creating poll options:", optionsError);
    // Try to clean up the poll if options failed
    await supabase.from("polls").delete().eq("id", poll.id);
    throw optionsError;
  }

  return poll;
}

export async function deletePoll(id) {
  const { error } = await supabase.rpc("admin_delete_poll", {
    poll_id_param: id,
  });
  
  if (error) {
    console.error("Error deleting poll:", error);
    throw error;
  }
}

export async function addVote(pollId, optionId, userHash) {
  // Check if user has already voted
  const hasVoted = await checkIfVoted(pollId, userHash);
  if (hasVoted) {
    throw new Error("You have already voted on this poll");
  }

  // Record vote
  const { error: voteError } = await supabase
    .from("votes")
    .insert([{ poll_id: pollId, user_hash: userHash }]);

  if (voteError) {
    console.error("Error recording vote:", voteError);
    throw voteError;
  }

  // Increment vote count
  const { error: incrementError } = await supabase.rpc("increment_vote", { 
    option_id: optionId 
  });

  if (incrementError) {
    console.error("Error incrementing vote count:", incrementError);
    throw incrementError;
  }
}