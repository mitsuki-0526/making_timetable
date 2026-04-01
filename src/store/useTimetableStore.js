import { create } from 'zustand';

// --- ダミーデータ定義 ---
const dummyTeachers = [
  { id: 'T01', name: '山田 (国語)', subjects: ['国語'], target_grades: [1, 2], unavailable_times: [{ day_of_week: '月', period: 1 }] },
  { id: 'T02', name: '佐藤 (数学)', subjects: ['数学'], target_grades: [1, 3], unavailable_times: [{ day_of_week: '火', period: 2 }] },
  { id: 'T03', name: '鈴木 (英語)', subjects: ['英語'], target_grades: [1, 2, 3], unavailable_times: [] },
  { id: 'T04', name: '高橋 (理科)', subjects: ['理科'], target_grades: [2, 3], unavailable_times: [{ day_of_week: '水', period: 3 }, { day_of_week: '水', period: 4 }] },
];

// 教科ごとの制約（連続授業日数上限など）
const dummySubjectConstraints = {
  '国語': { max_consecutive_days: null },
  '数学': { max_consecutive_days: null },
  '英語': { max_consecutive_days: null },
  '理科': { max_consecutive_days: null },
  '自立活動': { max_consecutive_days: null },
};

const dummyStructure = {
  grades: [
    { grade: 1, classes: ['1組', '2組'], special_classes: ['特支1'] },
    { grade: 2, classes: ['1組'], special_classes: ['特支2'] },
    { grade: 3, classes: [], special_classes: [] } // 必要に応じて拡張可能
  ],
  // 規定授業時数（週当たり）
  required_hours: {
    '1_通常': { '国語': 4, '数学': 4, '英語': 4, '理科': 3 },
    '1_特支': { '国語': 3, '数学': 3, '自立活動': 4 },
    '2_通常': { '国語': 4, '数学': 3, '英語': 4, '理科': 4 },
    '2_特支': { '国語': 2, '数学': 2, '自立活動': 5 }
  }
};

// 初期状態の構築
const initialTimetable = [];

export const useTimetableStore = create((set, get) => ({
  teachers: dummyTeachers,
  teacher_groups: [],          // 教員グループ: [{ id, name, teacher_ids }]
  structure: dummyStructure,
  timetable: initialTimetable,
  subject_constraints: dummySubjectConstraints,
  settings: {
    // 特別支援学級の教科連動マッピングルール (学年をキーとして持つ)
    mappingRules: {
      '1': { '国語': '自立活動', '数学': '自立活動' },
      '2': { '国語': '自立活動' }
    }
  },

  // コマの配置更新と特別支援学級への連動処理
  setTimetableEntry: (day_of_week, period, grade, class_name, teacher_id, subject) => {
    set((state) => {
      let currentTimetable = [...state.timetable];
      
      // 対象セルのエントリを削除
      currentTimetable = currentTimetable.filter(
        entry => !(entry.day_of_week === day_of_week && entry.period === period && entry.grade === grade && entry.class_name === class_name)
      );

      // 新しいエントリを追加
      if (teacher_id || subject) {
        currentTimetable.push({
          day_of_week,
          period,
          grade,
          class_name,
          teacher_id,
          subject
        });
      }

      // 【特別支援学級マッピング機能（自動連動）】
      // もし操作したのが「通常学級」で、設定された「教科」がマッピングの対象になっていれば、特別支援学級にも自動配置
      const isNormalClass = !class_name.includes('特支');
      if (isNormalClass && subject) {
        const gradeRules = state.settings.mappingRules[grade] || {};
        // ルールが存在しない場合は、通常学級の教科をそのまま採用
        const mappedSubject = gradeRules[subject] || subject;
        
        if (mappedSubject) {
          const targetGradeObj = state.structure.grades.find(g => g.grade === grade);
          if (targetGradeObj && targetGradeObj.special_classes) {
            targetGradeObj.special_classes.forEach((spClass) => {
              // 現在の特支の同曜日/時限エントリを検索
              const spEntryIdx = currentTimetable.findIndex(e => e.day_of_week === day_of_week && e.period === period && e.grade === grade && e.class_name === spClass);
              
              if (spEntryIdx >= 0) {
                // 既にエントリがある場合、教員を残して「教科」だけ上書き
                currentTimetable[spEntryIdx] = {
                  ...currentTimetable[spEntryIdx],
                  subject: mappedSubject
                };
              } else {
                // エントリがない場合は新規追加 (教員はnull)
                currentTimetable.push({
                  day_of_week,
                  period,
                  grade: grade, // 特支も学年を持つ
                  class_name: spClass,
                  teacher_id: null,
                  subject: mappedSubject
                });
              }
            });
          }
        }
      }

      return { timetable: currentTimetable };
    });
  },

  // --- 教科と規定時数の管理 ---
  addSubject: (newSubject) => {
    set((state) => {
      const newStruct = { ...state.structure };
      Object.keys(newStruct.required_hours).forEach(key => {
        if (newStruct.required_hours[key][newSubject] === undefined) {
          newStruct.required_hours[key][newSubject] = 0; // 初期値は0
        }
      });
      const newConstraints = { ...state.subject_constraints };
      if (newConstraints[newSubject] === undefined) {
        newConstraints[newSubject] = { max_consecutive_days: null };
      }
      return { structure: newStruct, subject_constraints: newConstraints };
    });
  },

  removeSubject: (subjectToDelete) => {
    set((state) => {
      const newStruct = { ...state.structure };
      Object.keys(newStruct.required_hours).forEach(key => {
        if (newStruct.required_hours[key]) {
          delete newStruct.required_hours[key][subjectToDelete];
        }
      });

      // 時間割からも該当する教科の枠を削除する
      const newTimetable = state.timetable.filter(e => e.subject !== subjectToDelete);

      // 連動ルールからも削除
      const newSettings = { ...state.settings, mappingRules: { ...state.settings.mappingRules } };
      Object.keys(newSettings.mappingRules).forEach(g => {
        if (newSettings.mappingRules[g][subjectToDelete]) {
          delete newSettings.mappingRules[g][subjectToDelete];
        }
      });

      // 教科制約からも削除
      const newConstraints = { ...state.subject_constraints };
      delete newConstraints[subjectToDelete];

      return { structure: newStruct, timetable: newTimetable, settings: newSettings, subject_constraints: newConstraints };
    });
  },

  // 教科の連続授業日数上限を更新
  updateSubjectConstraint: (subject, maxConsecutiveDays) => {
    set((state) => ({
      subject_constraints: {
        ...state.subject_constraints,
        [subject]: { max_consecutive_days: maxConsecutiveDays }
      }
    }));
  },

  updateRequiredHours: (keyString, subject, hours) => {
    set((state) => {
      const newStruct = { ...state.structure };
      if (!newStruct.required_hours[keyString]) {
         newStruct.required_hours[keyString] = {};
      }
      newStruct.required_hours[keyString][subject] = parseInt(hours, 10) || 0;
      return { structure: newStruct };
    });
  },

  // --- 連動ルールの管理 ---
  addMappingRule: (grade, fromSubj, toSubj) => {
    set((state) => {
      const gradeRules = state.settings.mappingRules[grade] || {};
      return {
        settings: {
          ...state.settings,
          mappingRules: {
            ...state.settings.mappingRules,
            [grade]: {
              ...gradeRules,
              [fromSubj]: toSubj
            }
          }
        }
      };
    });
  },

  removeMappingRule: (grade, fromSubj) => {
    set((state) => {
      const newGradeRules = { ...(state.settings.mappingRules[grade] || {}) };
      delete newGradeRules[fromSubj];
      return {
        settings: {
          ...state.settings,
          mappingRules: {
            ...state.settings.mappingRules,
            [grade]: newGradeRules
          }
        }
      };
    });
  },

  // 動的プルダウン制御：特定のコマに配置可能な教員リストを取得するセレクタ
  getAvailableTeachers: (day_of_week, period, target_grade) => {
    const state = get();
    return state.teachers.filter(teacher => {
      // フィルタ1: 担当学年か？
      // 「特別支援」担当の先生は学年に関わらず全特支クラスに配置可能なのでスキップ
      const isTokkiShien = teacher.subjects.includes('特別支援');
      if (!isTokkiShien && typeof target_grade !== 'string' && !teacher.target_grades.includes(target_grade)) {
        return false;
      }

      // フィルタ2: 配置不可時間（出張等）に含まれていないか？
      const isUnavailable = teacher.unavailable_times.some(
        time => time.day_of_week === day_of_week && time.period === period
      );
      if (isUnavailable) return false;

          // フィルタ3: 同日・同時限の他クラスと重複していないか？（主担当・B週担当・グループ所属の全てをチェック）
      const isAlreadyAssigned = state.timetable.some(entry => {
        if (entry.day_of_week !== day_of_week || entry.period !== period) return false;
        if (entry.teacher_id === teacher.id || entry.alt_teacher_id === teacher.id) return true;
        // グループ経由の重複チェック
        if (entry.teacher_group_id) {
          const grp = (state.teacher_groups || []).find(g => g.id === entry.teacher_group_id);
          if (grp?.teacher_ids?.includes(teacher.id)) return true;
        }
        return false;
      });
      if (isAlreadyAssigned) return false;

      return true;
    });
  },

  getEntry: (day_of_week, period, grade, class_name) => {
    const state = get();
    return state.timetable.find(
      entry => entry.day_of_week === day_of_week && entry.period === period && entry.grade === grade && entry.class_name === class_name
    );
  },

  // 同じ日における、同じ教科の配置数をチェック
  getDailySubjectCount: (day_of_week, grade, class_name, subject) => {
    const state = get();
    if (!subject) return 0;
    return state.timetable.filter(
      entry => entry.day_of_week === day_of_week && entry.grade === grade && entry.class_name === class_name && entry.subject === subject
    ).length;
  },

  // 特定クラスの現在の教科別設定時数を集計
  // 隔週授業（alt_subject あり）はA週・B週それぞれ 0.5 コマとしてカウント
  getClassSubjectTotals: (grade, class_name) => {
    const state = get();
    const totals = {};
    const classEntries = state.timetable.filter(
      entry => entry.grade === grade && entry.class_name === class_name && entry.subject
    );
    classEntries.forEach(entry => {
      // 隔週授業も通常授業と同様に1コマとしてカウント（A週・B週それぞれ1）
      totals[entry.subject] = (totals[entry.subject] || 0) + 1;
      if (entry.alt_subject) {
        totals[entry.alt_subject] = (totals[entry.alt_subject] || 0) + 1;
      }
    });
    return totals;
  },
  
  // 教科ごとの連続授業日数違反を取得するセレクタ
  getConsecutiveDaysViolations: () => {
    const state = get();
    const DAYS = ['月', '火', '水', '木', '金'];
    const violations = [];

    // 全クラスを列挙
    const classes = [];
    state.structure.grades.forEach(g => {
      g.classes.forEach(c => classes.push({ grade: g.grade, class_name: c }));
      if (g.special_classes) {
        g.special_classes.forEach(c => classes.push({ grade: g.grade, class_name: c }));
      }
    });

    // 上限が設定されている教科のみ対象
    const constrainedSubjects = Object.entries(state.subject_constraints || {})
      .filter(([, c]) => c.max_consecutive_days != null);

    classes.forEach(({ grade, class_name }) => {
      constrainedSubjects.forEach(([subject, constraint]) => {
        // 隔週授業の alt_subject も含めてチェック（A週・B週どちらも対象）
        const hasSubjectOnDay = DAYS.map(day =>
          state.timetable.some(e =>
            e.grade === grade && e.class_name === class_name &&
            e.day_of_week === day &&
            (e.subject === subject || e.alt_subject === subject)
          )
        );

        let maxConsecutive = 0, current = 0;
        hasSubjectOnDay.forEach(has => {
          current = has ? current + 1 : 0;
          if (current > maxConsecutive) maxConsecutive = current;
        });

        if (maxConsecutive >= constraint.max_consecutive_days) {
          violations.push({ grade, class_name, subject, maxConsecutive, limit: constraint.max_consecutive_days });
        }
      });
    });

    return violations;
  },

  // 隔週授業のB週教科・担当教員を設定（既存エントリに追記）
  setAltEntry: (day_of_week, period, grade, class_name, alt_subject, alt_teacher_id) => {
    set((state) => {
      const newTimetable = state.timetable.map(e => {
        if (
          e.day_of_week === day_of_week && e.period === period &&
          e.grade === grade && e.class_name === class_name
        ) {
          return {
            ...e,
            alt_subject:    alt_subject    || null,
            alt_teacher_id: alt_teacher_id || null,
          };
        }
        return e;
      });
      return { timetable: newTimetable };
    });
  },

  // --- クラウド/ローカル保存用 ---
  importState: (newState) => {
    set({
      teachers: newState.teachers || [],
      teacher_groups: newState.teacher_groups || [],
      structure: newState.structure || dummyStructure,
      timetable: newState.timetable || [],
      settings: newState.settings || { mappingRules: {} },
      subject_constraints: newState.subject_constraints || dummySubjectConstraints
    });
  },

  // --- クラス設定管理 ---
  addClass: (grade, className, isSpecial) => {
    set((state) => {
      const newStruct = { ...state.structure };
      const gObj = newStruct.grades.find(g => g.grade === grade);
      if (gObj) {
        if (isSpecial) {
          if (!gObj.special_classes) gObj.special_classes = [];
          if (!gObj.special_classes.includes(className)) gObj.special_classes.push(className);
        } else {
          if (!gObj.classes.includes(className)) gObj.classes.push(className);
        }
      }
      return { structure: newStruct };
    });
  },

  removeClass: (grade, className, isSpecial) => {
    // 時間割から該当クラスのデータも削除する
    set((state) => {
      const newStruct = { ...state.structure };
      const gObj = newStruct.grades.find(g => g.grade === grade);
      if (gObj) {
        if (isSpecial) {
          gObj.special_classes = gObj.special_classes.filter(c => c !== className);
        } else {
          gObj.classes = gObj.classes.filter(c => c !== className);
        }
      }
      const newTimetable = state.timetable.filter(
        e => !(e.grade === grade && e.class_name === className)
      );
      return { structure: newStruct, timetable: newTimetable };
    });
  },

  // --- 教員設定管理 ---
  addTeacher: (teacherData) => {
    // teacherData: { name, subjects, target_grades, unavailable_times }
    set((state) => {
      const newId = `T${Date.now()}`;
      return {
        teachers: [...state.teachers, { id: newId, ...teacherData }]
      };
    });
  },

  updateTeacher: (id, teacherData) => {
    set((state) => ({
      teachers: state.teachers.map(t => (t.id === id ? { ...t, ...teacherData } : t))
    }));
  },

  // --- 教員グループ管理 ---
  addTeacherGroup: ({ name, teacher_ids }) => {
    set((state) => ({
      teacher_groups: [
        ...state.teacher_groups,
        { id: `TG${Date.now()}`, name: name.trim(), teacher_ids }
      ]
    }));
  },

  updateTeacherGroup: (id, data) => {
    set((state) => ({
      teacher_groups: state.teacher_groups.map(g => g.id === id ? { ...g, ...data } : g)
    }));
  },

  removeTeacherGroup: (id) => {
    set((state) => ({
      teacher_groups: state.teacher_groups.filter(g => g.id !== id),
      // グループが割り当てられていたコマを解除
      timetable: state.timetable.map(e =>
        e.teacher_group_id === id ? { ...e, teacher_group_id: null } : e
      )
    }));
  },

  // コマにグループを割り当て（teacher_id をクリアしてグループIDをセット）
  setEntryGroup: (day_of_week, period, grade, class_name, teacher_group_id) => {
    set((state) => ({
      timetable: state.timetable.map(e => {
        if (
          e.day_of_week === day_of_week && e.period === period &&
          e.grade === grade && e.class_name === class_name
        ) {
          return {
            ...e,
            teacher_id: teacher_group_id ? null : e.teacher_id,
            teacher_group_id: teacher_group_id || null,
          };
        }
        return e;
      })
    }));
  },

  // AI生成の時間割を適用（timetableのみ差し替え・他の設定は保持）
  setGeneratedTimetable: (entries) => {
    set({ timetable: entries });
  },

  removeTeacher: (id) => {
    set((state) => {
      // 主担当・B週担当のどちらに入っていても null にする
      const newTimetable = state.timetable.map(e => ({
        ...e,
        teacher_id:     e.teacher_id     === id ? null : e.teacher_id,
        alt_teacher_id: e.alt_teacher_id === id ? null : e.alt_teacher_id,
      }));
      // 所属グループからも削除
      const newGroups = state.teacher_groups.map(g => ({
        ...g,
        teacher_ids: g.teacher_ids.filter(tid => tid !== id)
      }));
      return {
        teachers: state.teachers.filter(t => t.id !== id),
        teacher_groups: newGroups,
        timetable: newTimetable
      };
    });
  }
}));
