/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CollectionMeta, DocumentClient, CollectionPartitionKey, RetrievedDocument, FeedOptions, QueryIterator } from 'documentdb';
import { IAzureNode, IAzureTreeItem, UserCancelledError, DialogResponses } from 'vscode-azureextensionui';
import * as vscode from 'vscode';
import { getDocumentClient } from "../getDocumentClient";
import * as path from "path";
import { DocDBDocumentTreeItem } from './DocDBDocumentTreeItem';
import { DocDBTreeItemBase } from './DocDBTreeItemBase';

/**
 * Represents a DocumentDB collection
 */
export class DocDBCollectionTreeItem extends DocDBTreeItemBase<RetrievedDocument> {
    public static contextValue: string = "cosmosDBDocumentCollection";
    public readonly contextValue: string = DocDBCollectionTreeItem.contextValue;

    constructor(
        private _documentEndpoint: string,
        private _masterKey: string,
        private _collection: CollectionMeta,
        private _isEmulator: boolean) {
        super(_documentEndpoint, _masterKey, _isEmulator);
    }

    public get id(): string {
        return this._collection.id;
    }

    public get label(): string {
        return this._collection.id;
    }

    public get iconPath(): string | vscode.Uri | { light: string | vscode.Uri; dark: string | vscode.Uri } {
        return {
            light: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'icons', 'theme-agnostic', 'Collection.svg'),
            dark: path.join(__filename, '..', '..', '..', '..', '..', 'resources', 'icons', 'theme-agnostic', 'Collection.svg')
        };
    }

    public get link(): string {
        return this._collection._self;
    }

    public get partitionKey(): CollectionPartitionKey | undefined {
        return this._collection.partitionKey;
    }

    public getDocumentClient(): DocumentClient {
        return getDocumentClient(this._documentEndpoint, this._masterKey, this._isEmulator);
    }

    public async deleteTreeItem(_node: IAzureNode): Promise<void> {
        const message: string = `Are you sure you want to delete collection '${this.label}' and its contents?`;
        const result = await vscode.window.showWarningMessage(message, { modal: true }, DialogResponses.deleteResponse, DialogResponses.cancel);
        if (result === DialogResponses.deleteResponse) {
            const client = this.getDocumentClient();
            await new Promise((resolve, reject) => {
                client.deleteCollection(this.link, function (err) {
                    err ? reject(err) : resolve();
                });
            });
        } else {
            throw new UserCancelledError();
        }
    }

    // #region Temporary changes to remove Documents node until viewing/editor stored procedures is implemented

    // private readonly _documentsTreeItem: DocDBDocumentsTreeItem;
    // private readonly _storedProceduresTreeItem: DocDBStoredProceduresTreeItem;

    // public constructor() {
    //     this._documentsTreeItem = new DocDBDocumentsTreeItem(this._documentEndpoint, this._masterKey, this, this._isEmulator);
    //     this._storedProceduresTreeItem = new DocDBStoredProceduresTreeItem(this._documentEndpoint, this._masterKey, this._collection, this._isEmulator);
    // }

    // public async loadMoreChildren(node: IAzureNode<IAzureTreeItem>, clearCache: boolean): Promise<IAzureTreeItem[]> {
    //     return [this._documentsTreeItem, this._storedProceduresTreeItem];
    // }

    // public hasMoreChildren(): boolean {
    //     return false;
    // }

    // public pickTreeItem?(expectedContextValue: string): IAzureTreeItem | undefined {
    //     switch (expectedContextValue) {
    //         case DocDBDocumentsTreeItem.contextValue:
    //         case DocDBDocumentTreeItem.contextValue:
    //             return this._documentsTreeItem;

    //         case DocDBStoredProceduresTreeItem.contextValue:
    //         case DocDBStoredProcedureTreeItem.contextValue:
    //             return this._storedProceduresTreeItem;

    //         default:
    //             return undefined;
    //     }
    // }

    public readonly childTypeLabel: string = "Documents";

    public async getIterator(client: DocumentClient, feedOptions: FeedOptions): Promise<QueryIterator<RetrievedDocument>> {
        return await client.readDocuments(this.link, feedOptions);
    }

    public initChild(document: RetrievedDocument): IAzureTreeItem {
        return new DocDBDocumentTreeItem(this, document);
    }

    public async createChild(_node: IAzureNode, showCreatingNode: (label: string) => void): Promise<IAzureTreeItem> {
        const client = this.getDocumentClient();
        let docID = await vscode.window.showInputBox({
            prompt: "Enter a unique document ID or leave blank for a generated ID",
            ignoreFocusOut: true
        });

        if (docID || docID === "") {
            docID = docID.trim();
            showCreatingNode(docID);
            const document: RetrievedDocument = await new Promise<RetrievedDocument>((resolve, reject) => {
                client.createDocument(this.link, { 'id': docID }, (err, result: RetrievedDocument) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(result);
                    }
                });
            });

            return this.initChild(document);
        }

        throw new UserCancelledError();
    }

    // #endregion
}
