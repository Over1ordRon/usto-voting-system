import { supabase } from "./supabase";

export async function getActivePolls() {
  const { data, error } = await supabase.rpc("get_active_polls");
  if (error) throw error;

  const map = new Map();
  data.forEach((row) => {
    if (!map.has(row.poll_id)) {
      map.set(row.poll_id, {
        id: row.poll_id,
        question: row.question,
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

export async function createPoll(question, options, createdBy) {
  const { data: poll, error } = await supabase
    .from("polls")
    .insert([{ question, created_by: createdBy, active: true }])
    .select()
    .single();

  if (error) throw error;

  const formattedOptions = options.map((text) => ({
    poll_id: poll.id,
    text,
    votes: 0,
  }));

  await supabase.from("poll_options").insert(formattedOptions);
  return poll;
}

export async function deletePoll(id) {
  const { error } = await supabase.rpc("admin_delete_poll", {
    poll_id_param: id,
  });
  if (error) throw error;
}

export async function addVote(pollId, optionId, userHash) {
  // record vote
  await supabase.from("votes").insert([{ poll_id: pollId, user_hash: userHash }]);

  // increase vote count
  await supabase.rpc("increment_vote", { option_id: optionId });
}
