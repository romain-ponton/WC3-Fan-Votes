import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

const lanApiUrl = "http://10.149.132.235:3000";
const localApiUrl = "http://localhost:3000";
const defaultApiUrl = lanApiUrl;

export default function App() {
  const [apiUrl, setApiUrl] = useState(defaultApiUrl);
  const [draftApiUrl, setDraftApiUrl] = useState(defaultApiUrl);
  const [polls, setPolls] = useState([]);
  const [selectedPollId, setSelectedPollId] = useState(null);
  const [selectedChoiceId, setSelectedChoiceId] = useState(null);
  const [ranking, setRanking] = useState([]);
  const [dashboard, setDashboard] = useState({ teams: [], players: [], matches: [] });
  const [userId, setUserId] = useState("mobile_supporter");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const selectedPoll = useMemo(
    () => polls.find((poll) => poll.pollId === selectedPollId),
    [polls, selectedPollId]
  );

  async function request(path, options) {
    const response = await fetch(`${apiUrl}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.error || "Erreur API");
    }
    return body;
  }

  async function loadData() {
    setLoading(true);
    try {
      const [nextPolls, nextDashboard] = await Promise.all([
        request("/api/polls"),
        request("/api/dashboard")
      ]);
      setPolls(nextPolls);
      setDashboard(nextDashboard);
      const nextPollId = selectedPollId || nextPolls[0]?.pollId;
      setSelectedPollId(nextPollId);
      if (nextPollId) {
        setRanking(await request(`/api/polls/${nextPollId}/ranking`));
      }
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function selectPoll(pollId) {
    setSelectedPollId(pollId);
    setSelectedChoiceId(null);
    setRanking(await request(`/api/polls/${pollId}/ranking`));
  }

  async function vote() {
    if (!selectedPollId || !selectedChoiceId) {
      setMessage("Choisis une option avant de voter.");
      return;
    }
    try {
      await request(`/api/polls/${selectedPollId}/vote`, {
        method: "POST",
        body: JSON.stringify({ userId, choiceId: selectedChoiceId })
      });
      setMessage("Vote enregistre.");
      await loadData();
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 7000);
    return () => clearInterval(timer);
  }, [apiUrl]);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Live sports analytics</Text>
          <Text style={styles.title}>WC3 Fan Votes</Text>
          <Text style={styles.subtitle}>Vote mobile et tendances Redis en direct.</Text>
        </View>

        <View style={styles.apiCard}>
          <Text style={styles.label}>API</Text>
          <TextInput
            value={draftApiUrl}
            onChangeText={setDraftApiUrl}
            autoCapitalize="none"
            style={styles.input}
            placeholder="http://192.168.1.xx:3000"
            placeholderTextColor="#6f7777"
          />
          <Pressable style={styles.buttonSecondary} onPress={() => setApiUrl(draftApiUrl.trim())}>
            <Text style={styles.buttonText}>Connecter</Text>
          </Pressable>
          <View style={styles.quickRow}>
            <Pressable
              style={styles.quickButton}
              onPress={() => {
                setDraftApiUrl(lanApiUrl);
                setApiUrl(lanApiUrl);
              }}
            >
              <Text style={styles.quickButtonText}>API Wi-Fi</Text>
            </Pressable>
            <Pressable
              style={styles.quickButton}
              onPress={() => {
                setDraftApiUrl(localApiUrl);
                setApiUrl(localApiUrl);
              }}
            >
              <Text style={styles.quickButtonText}>Localhost</Text>
            </Pressable>
          </View>
        </View>

        {loading ? <ActivityIndicator color="#9ec86f" /> : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Votes ouverts</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {polls.map((poll) => (
              <Pressable
                key={poll.pollId}
                style={[styles.pollCard, selectedPollId === poll.pollId && styles.activeCard]}
                onPress={() => selectPoll(poll.pollId)}
              >
                <Text style={styles.pollMatch}>{poll.match}</Text>
                <Text style={styles.pollQuestion}>{poll.question}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {selectedPoll ? (
          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>{selectedPoll.match}</Text>
            <Text style={styles.pollQuestion}>{selectedPoll.question}</Text>
            {selectedPoll.choices.map((choice) => (
              <Pressable
                key={choice.choiceId}
                style={[styles.choice, selectedChoiceId === choice.choiceId && styles.activeChoice]}
                onPress={() => setSelectedChoiceId(choice.choiceId)}
              >
                <Text style={styles.choiceLabel}>{choice.label}</Text>
                <Text style={styles.pollQuestion}>{choice.team}</Text>
              </Pressable>
            ))}
            <TextInput value={userId} onChangeText={setUserId} style={styles.input} />
            <Pressable style={styles.button} onPress={vote}>
              <Text style={styles.buttonText}>Voter</Text>
            </Pressable>
          </View>
        ) : null}

        <Trend title="Classement du vote" rows={ranking} />
        <Trend title="Equipes populaires" rows={dashboard.teams} />
        <Trend title="Joueurs populaires" rows={dashboard.players} />
        <Trend title="Matchs actifs" rows={dashboard.matches} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Trend({ title, rows }) {
  const max = Math.max(...rows.map((row) => row.votes), 1);
  return (
    <View style={styles.panel}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {rows.map((row, index) => (
        <View key={`${row.label}-${index}`} style={styles.rankRow}>
          <Text style={styles.rankNumber}>{index + 1}</Text>
          <View style={styles.rankMain}>
            <Text style={styles.choiceLabel}>{row.label}</Text>
            <View style={styles.bar}>
              <View style={[styles.barFill, { width: `${(row.votes / max) * 100}%` }]} />
            </View>
          </View>
          <Text style={styles.votes}>{row.votes}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#050606"
  },
  content: {
    padding: 18,
    gap: 16
  },
  header: {
    paddingTop: 12
  },
  eyebrow: {
    color: "#9ec86f",
    fontWeight: "800",
    textTransform: "uppercase"
  },
  title: {
    color: "#f2f2ee",
    fontSize: 44,
    fontWeight: "900",
    lineHeight: 46,
    marginTop: 8
  },
  subtitle: {
    color: "#aeb8b9",
    marginTop: 10,
    fontSize: 16
  },
  apiCard: {
    borderWidth: 1,
    borderColor: "#2a3131",
    borderRadius: 22,
    padding: 16,
    backgroundColor: "#111414",
    gap: 10
  },
  label: {
    color: "#aeb8b9"
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#2a3131",
    borderRadius: 999,
    paddingHorizontal: 14,
    color: "#f2f2ee",
    backgroundColor: "#090b0b"
  },
  button: {
    minHeight: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#9ec86f",
    marginTop: 12
  },
  buttonSecondary: {
    minHeight: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#608882"
  },
  quickRow: {
    flexDirection: "row",
    gap: 10
  },
  quickButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#2a3131",
    backgroundColor: "#0c0f0f"
  },
  quickButtonText: {
    color: "#f2f2ee",
    fontWeight: "800"
  },
  buttonText: {
    color: "#101313",
    fontWeight: "900"
  },
  message: {
    color: "#9ec86f"
  },
  section: {
    gap: 12
  },
  sectionTitle: {
    color: "#f2f2ee",
    fontSize: 21,
    fontWeight: "900",
    marginBottom: 10
  },
  pollCard: {
    width: 230,
    minHeight: 120,
    borderWidth: 1,
    borderColor: "#2a3131",
    borderRadius: 22,
    padding: 16,
    backgroundColor: "#111414",
    marginRight: 12
  },
  activeCard: {
    borderColor: "#9ec86f"
  },
  pollMatch: {
    color: "#f2f2ee",
    fontSize: 18,
    fontWeight: "900"
  },
  pollQuestion: {
    color: "#aeb8b9",
    marginTop: 8
  },
  panel: {
    borderWidth: 1,
    borderColor: "#2a3131",
    borderRadius: 22,
    padding: 16,
    backgroundColor: "#111414"
  },
  choice: {
    borderWidth: 1,
    borderColor: "#2a3131",
    borderRadius: 18,
    padding: 14,
    marginTop: 10,
    backgroundColor: "#0c0f0f"
  },
  activeChoice: {
    borderColor: "#9ec86f"
  },
  choiceLabel: {
    color: "#f2f2ee",
    fontWeight: "800"
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12
  },
  rankNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    textAlign: "center",
    lineHeight: 30,
    color: "#101313",
    backgroundColor: "#9ec86f",
    fontWeight: "900"
  },
  rankMain: {
    flex: 1
  },
  bar: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#2a3131",
    overflow: "hidden",
    marginTop: 8
  },
  barFill: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#ab4335"
  },
  votes: {
    color: "#f2f2ee",
    fontWeight: "900",
    minWidth: 28,
    textAlign: "right"
  }
});
