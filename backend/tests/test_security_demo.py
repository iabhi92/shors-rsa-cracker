from fastapi.testclient import TestClient


def test_malleability_attack_produces_predicted_plaintext(client: TestClient) -> None:
    kg = client.post("/api/rsa/keygen", json={"bits": 24}).json()
    n, e, d = kg["n"], kg["e"], kg["d"]
    message_int = 7

    r = client.post(
        "/api/security-demo/malleability",
        json={"n": n, "e": e, "d": d, "message_int": message_int, "blind_factor": 3},
    )
    assert r.status_code == 200
    body = r.json()
    # Ciphertext/plaintext fields are decimal strings, not JSON numbers -- see
    # MalleabilityResponse's own docstring: with the OAEP toggle these carry values the size of
    # a 1024-bit modulus, well past what a JS float64 can represent exactly.
    assert int(body["original_plaintext"]) == message_int
    assert int(body["tampered_plaintext"]) == (message_int * 3) % n
    assert body["expected_tampered_plaintext"] == body["tampered_plaintext"]
    assert body["matches_prediction"] is True
    # The attacker's view (ciphertext + blinding math) never touches d.
    assert body["original_ciphertext"] != body["tampered_ciphertext"]


def test_oaep_keygen_returns_a_real_1024_bit_key(client: TestClient) -> None:
    r = client.post("/api/security-demo/oaep-keygen")
    assert r.status_code == 200
    body = r.json()
    # p/q/n/e/d are decimal strings for the same reason -- see OaepKeygenResponse's docstring.
    # generate_keypair's own docstring: two `bits/2`-bit primes multiplied can land the product
    # one bit short of the target (2^1022 <= p*q < 2^1024) -- not always exactly 1024.
    assert isinstance(body["n"], str)
    assert 1023 <= int(body["n"]).bit_length() <= 1024


def test_malleability_with_oaep_detects_the_tampered_ciphertext(client: TestClient) -> None:
    # OAEP with SHA-256 needs a modulus of at least 528 bits -- this project's usual 8-24 bit
    # teaching keys have nowhere near enough room, so this specific demo needs its own real key.
    kg = client.post("/api/security-demo/oaep-keygen").json()
    n, e, d = kg["n"], kg["e"], kg["d"]
    message_int = 7

    r = client.post(
        "/api/security-demo/malleability",
        json={"n": n, "e": e, "d": d, "message_int": message_int, "blind_factor": 3, "use_oaep": True},
    )
    assert r.status_code == 200
    body = r.json()
    # The ciphertext-level algebra is completely unaffected by OAEP -- it never looks past c.
    assert body["matches_prediction"] is True
    assert body["oaep_used"] is True
    # The victim's own message still round-trips correctly.
    assert body["original_oaep_valid"] is True
    assert body["original_message_int"] == message_int
    # The attacker's tampered ciphertext, however, no longer silently decrypts to a
    # usable/predictable message -- OAEP's structural check now catches it.
    assert body["tampered_oaep_valid"] is False
    assert body["tampered_message_int"] is None


def test_malleability_oaep_rejects_modulus_too_small(client: TestClient) -> None:
    kg = client.post("/api/rsa/keygen", json={"bits": 24}).json()
    n, e, d = kg["n"], kg["e"], kg["d"]
    r = client.post(
        "/api/security-demo/malleability",
        json={"n": n, "e": e, "d": d, "message_int": 7, "blind_factor": 3, "use_oaep": True},
    )
    assert r.status_code == 400
    assert "528 bits" in r.json()["detail"]


def test_malleability_rejects_message_out_of_range(client: TestClient) -> None:
    kg = client.post("/api/rsa/keygen", json={"bits": 24}).json()
    r = client.post(
        "/api/security-demo/malleability",
        json={"n": kg["n"], "e": kg["e"], "d": kg["d"], "message_int": kg["n"] + 100, "blind_factor": 2},
    )
    assert r.status_code == 400


def test_malleability_rejects_blind_factor_below_two(client: TestClient) -> None:
    kg = client.post("/api/rsa/keygen", json={"bits": 24}).json()
    r = client.post(
        "/api/security-demo/malleability",
        json={"n": kg["n"], "e": kg["e"], "d": kg["d"], "message_int": 5, "blind_factor": 1},
    )
    assert r.status_code == 422


def _block_size_of(client: TestClient, n: int, e: int) -> int:
    return client.post("/api/rsa/encrypt", json={"message": "x", "n": n, "e": e}).json()["block_size_bytes"]


def test_block_substitution_splices_forged_block_undetected(client: TestClient) -> None:
    kg = client.post("/api/rsa/keygen", json={"bits": 24}).json()
    n, e, d = kg["n"], kg["e"], kg["d"]
    block_size = _block_size_of(client, n, e)
    message = "A" * (block_size * 3)  # spans multiple blocks, so block 0 is not the final block
    forged_text = ("EVIL" * block_size)[:block_size]  # fits exactly within this key's block size

    r = client.post(
        "/api/security-demo/tamper",
        json={"n": n, "e": e, "d": d, "message": message, "block_index": 0, "forged_block_text": forged_text},
    )
    assert r.status_code == 200
    body = r.json()
    # The splice always succeeds -- no error field, no "sometimes caught" branch, unlike a
    # raw ciphertext bit-flip whose fate depends on the key's bit length modulo 8.
    assert body["original_plaintext"] == message
    assert body["tampered_plaintext"] != message
    assert body["tampered_plaintext"].startswith(forged_text)
    assert body["original_ciphertext"][0] != body["tampered_ciphertext"][0]
    # Only the targeted block changed.
    assert body["original_ciphertext"][1:] == body["tampered_ciphertext"][1:]
    assert body["forged_block_index"] == 0


def test_block_substitution_rejects_final_block_index(client: TestClient) -> None:
    kg = client.post("/api/rsa/keygen", json={"bits": 24}).json()
    n, e, d = kg["n"], kg["e"], kg["d"]
    block_size = _block_size_of(client, n, e)
    message = "A" * (block_size * 3)

    # Encrypting "A"*(block_size*3) produces 4 blocks (a full block of PKCS7 padding is
    # always appended); the last valid non-final index is 2.
    r = client.post(
        "/api/security-demo/tamper",
        json={"n": n, "e": e, "d": d, "message": message, "block_index": 3, "forged_block_text": "x"},
    )
    assert r.status_code == 400


def test_block_substitution_rejects_forged_text_longer_than_block_size(client: TestClient) -> None:
    kg = client.post("/api/rsa/keygen", json={"bits": 24}).json()
    n, e, d = kg["n"], kg["e"], kg["d"]
    block_size = _block_size_of(client, n, e)
    message = "A" * (block_size * 3)

    r = client.post(
        "/api/security-demo/tamper",
        json={
            "n": n,
            "e": e,
            "d": d,
            "message": message,
            "block_index": 0,
            "forged_block_text": "x" * (block_size + 1),
        },
    )
    assert r.status_code == 400


def test_block_substitution_rejects_single_block_message(client: TestClient) -> None:
    kg = client.post("/api/rsa/keygen", json={"bits": 24}).json()
    n, e, d = kg["n"], kg["e"], kg["d"]

    r = client.post(
        "/api/security-demo/tamper",
        json={"n": n, "e": e, "d": d, "message": "h", "block_index": 0, "forged_block_text": "x"},
    )
    assert r.status_code == 400


def test_wiener_attack_recovers_the_full_key_from_a_vulnerable_keypair(client: TestClient) -> None:
    kg = client.post("/api/security-demo/wiener-keygen", json={"bits": 128}).json()
    assert int(kg["d"]).bit_length() == kg["d_bits"]
    assert kg["d_bits"] < kg["wiener_bound_bits"]

    r = client.post("/api/security-demo/wiener-attack", json={"n": kg["n"], "e": kg["e"]})
    assert r.status_code == 200
    body = r.json()
    assert body["succeeded"] is True
    assert body["recovered_d"] == kg["d"]
    assert {body["recovered_p"], body["recovered_q"]} == {kg["p"], kg["q"]}
    # The request body itself never included d -- the attack ran from n and e alone.


def test_wiener_attack_fails_against_a_normal_key(client: TestClient) -> None:
    kg = client.post("/api/rsa/keygen", json={"bits": 24}).json()
    r = client.post("/api/security-demo/wiener-attack", json={"n": str(kg["n"]), "e": str(kg["e"])})
    assert r.status_code == 200
    body = r.json()
    assert body["succeeded"] is False
    assert body["recovered_d"] is None


def test_wiener_attack_rejects_non_numeric_input(client: TestClient) -> None:
    r = client.post("/api/security-demo/wiener-attack", json={"n": "not-a-number", "e": "65537"})
    assert r.status_code == 400


def test_wiener_keygen_rejects_bits_outside_range(client: TestClient) -> None:
    assert client.post("/api/security-demo/wiener-keygen", json={"bits": 8}).status_code == 422
    assert client.post("/api/security-demo/wiener-keygen", json={"bits": 4096}).status_code == 422


def test_parity_oracle_attack_recovers_the_real_message(client: TestClient) -> None:
    kg = client.post("/api/rsa/keygen", json={"bits": 20}).json()
    n, e, d = kg["n"], kg["e"], kg["d"]
    message_int = 12345 % n

    r = client.post(
        "/api/security-demo/parity-oracle-attack",
        json={"n": n, "e": e, "d": d, "message_int": message_int},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["recovered_message"] == message_int
    assert body["matches_original"] is True
    assert body["total_queries"] == n.bit_length()
    assert len(body["steps"]) == body["total_queries"]
    # Every query is a real bit, and the private key is never in the response at all.
    assert all(step["oracle_bit"] in (0, 1) for step in body["steps"])
    assert "d" not in body


def test_parity_oracle_attack_rejects_message_out_of_range(client: TestClient) -> None:
    kg = client.post("/api/rsa/keygen", json={"bits": 16}).json()
    r = client.post(
        "/api/security-demo/parity-oracle-attack",
        json={"n": kg["n"], "e": kg["e"], "d": kg["d"], "message_int": kg["n"] + 5},
    )
    assert r.status_code == 400


def test_timing_oracle_returns_both_real_comparisons(client: TestClient) -> None:
    r = client.post("/api/security-demo/timing-oracle", json={"trials": 300})
    assert r.status_code == 200
    body = r.json()
    assert body["trials"] == 300
    for key in ("pkcs7", "oaep"):
        comparison = body[key]
        assert len(comparison["scenarios"]) == 3
        assert all(s["mean_ns"] > 0 for s in comparison["scenarios"])
        assert comparison["gap_ns"] >= 0
        assert comparison["verdict"]


def test_timing_oracle_rejects_trials_outside_range(client: TestClient) -> None:
    assert client.post("/api/security-demo/timing-oracle", json={"trials": 10}).status_code == 422
    assert client.post("/api/security-demo/timing-oracle", json={"trials": 100_000}).status_code == 422


def test_rate_limit_ping_trips_429_after_its_small_budget(client: TestClient) -> None:
    from backend.app.rate_limit import dashboard_demo_limiter

    for _ in range(dashboard_demo_limiter.max_requests):
        r = client.get("/api/security-demo/rate-limit-ping")
        assert r.status_code == 200
        assert r.json() == {"ok": True, "message": "request accepted"}

    r = client.get("/api/security-demo/rate-limit-ping")
    assert r.status_code == 429
    assert "Retry-After" in r.headers
