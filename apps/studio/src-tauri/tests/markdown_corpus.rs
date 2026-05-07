use std::{fs, path::PathBuf};

use memoire_studio_lib::markdown_corpus::{
    analyze_markdown_text, is_allowed_markdown_path, setup_markdown_corpus_at, CorpusRepo,
    CorpusRepoPolicy,
};

fn temp_root(name: &str) -> PathBuf {
    let root = std::env::temp_dir().join(format!(
        "memoire-rust-markdown-corpus-{name}-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    fs::create_dir_all(&root).unwrap();
    root
}

#[test]
fn allows_only_safe_markdown_paths() {
    assert!(is_allowed_markdown_path("docs/guide.mdx"));
    assert!(is_allowed_markdown_path("README.markdown"));
    assert!(!is_allowed_markdown_path("../README.md"));
    assert!(!is_allowed_markdown_path("docs/script.js"));
    assert!(!is_allowed_markdown_path(".github/secret.md"));
}

#[test]
fn setup_writes_manifest_and_skips_metadata_only_repos() {
    let root = temp_root("setup");
    let source = root.join("fixture-source");
    fs::create_dir_all(source.join("docs")).unwrap();
    fs::write(source.join("README.md"), "# Flow\n\n- Start\n- Finish\n").unwrap();
    fs::write(source.join("docs/guide.mdx"), "```mermaid\nflowchart TD\n  A --> B\n```\n").unwrap();
    fs::write(source.join("docs/app.js"), "console.log('skip')").unwrap();

    let repos = vec![
        CorpusRepo {
            owner: "fixture".into(),
            repo: "allowed".into(),
            license: "MIT".into(),
            branch: "main".into(),
            policy: CorpusRepoPolicy::Download,
            local_source: Some(source),
        },
        CorpusRepo {
            owner: "fixture".into(),
            repo: "blocked".into(),
            license: "AGPL-3.0".into(),
            branch: "main".into(),
            policy: CorpusRepoPolicy::MetadataOnly,
            local_source: None,
        },
    ];

    let status = setup_markdown_corpus_at(&root, &repos).unwrap();

    assert_eq!(status.status, "ready");
    assert_eq!(status.repos.len(), 2);
    assert_eq!(status.repos[0].files, 2);
    assert!(status.repos[0].bytes > 0);
    assert_eq!(status.repos[1].skipped, 1);
    assert!(root
        .join(".memoire/markdown-corpus/fixture/allowed/manifest.json")
        .is_file());
    assert!(!root
        .join(".memoire/markdown-corpus/fixture/allowed/docs/app.js")
        .exists());

    fs::remove_dir_all(root).unwrap();
}

#[test]
fn analyzer_extracts_mermaid_and_markdown_flow_candidates() {
    let report = analyze_markdown_text(
        "notes/flow.md",
        "# Checkout Flow\n\n- Open cart\n- Enter payment\n- Confirm\n\n```mermaid\nsequenceDiagram\n  User->>App: Pay\n```\n",
    );

    assert_eq!(report.candidates.len(), 2);
    assert_eq!(report.candidates[0].kind, "sequence");
    assert!(report.candidates[0].clean_source.contains("sequenceDiagram"));
    assert_eq!(report.candidates[1].kind, "checklist-to-flow");
    assert!(report.candidates[1].clean_source.contains("flowchart TD"));
}
